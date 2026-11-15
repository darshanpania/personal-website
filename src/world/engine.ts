import { WebGLRenderer } from "three";
import { stopFor } from "./stops";
import type { ThemeFactory, WorldContext, WorldTheme } from "./theme";

const MAX_PIXEL_RATIO = 2;
const MAX_DT = 0.05;

export interface WorldHandle {
  /** Start or stop drawing. A stopped world uses no CPU or GPU time. */
  setRunning(on: boolean): void;
  /** Frames drawn so far. For tests and debugging. */
  readonly frames: number;
}

const isDark = () => document.documentElement.classList.contains("dark");

const readScroll = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
};

/**
 * Start the 3D world on the given canvas. The promise resolves after the
 * first frame is on the canvas, and rejects if WebGL cannot start.
 *
 * The engine draws on demand: it stops the frame loop when the theme reports
 * that nothing moves, and starts it again on input (pointer, scroll, resize,
 * page change, dark mode).
 */
export async function startWorld(
  canvas: HTMLCanvasElement,
  createTheme: ThemeFactory,
): Promise<WorldHandle> {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let theme: WorldTheme | null = null;
  let running = true;
  let raf = 0;
  let last = 0;
  let time = 0;
  let frames = 0;
  let aspect = 1;
  let dark = isDark();
  let scroll = readScroll();
  const pointer = { x: 0, y: 0 };

  const draw = (now: number) => {
    raf = 0;
    if (!theme || !running || document.hidden) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60;
    last = now;
    time += dt;
    const busy = theme.update({ time, dt, pointer, scroll });
    renderer.render(theme.scene, theme.camera);
    frames += 1;
    if (busy) raf = requestAnimationFrame(draw);
    else last = 0;
  };

  const invalidate = () => {
    if (!raf && theme && running && !document.hidden) raf = requestAnimationFrame(draw);
  };

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    aspect = width / height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    if (theme) {
      theme.camera.aspect = aspect;
      theme.camera.updateProjectionMatrix();
      theme.resize?.(aspect);
    }
    invalidate();
  };

  const ctx: WorldContext = {
    renderer,
    get reducedMotion() {
      return motion.matches;
    },
    get dark() {
      return dark;
    },
    get aspect() {
      return aspect;
    },
    invalidate,
  };

  try {
    resize();
    theme = await createTheme(ctx);
    resize();
    theme.goTo(stopFor(location.pathname), { instant: true });
    draw(performance.now());
  } catch (error) {
    theme?.dispose();
    renderer.dispose();
    throw error;
  }
  const world = theme;

  // Site → world bridge. The canvas and this module outlive page changes
  // (view transitions), so each listener is registered once.
  document.addEventListener("astro:page-load", () => {
    scroll = readScroll();
    world.goTo(stopFor(location.pathname), { instant: motion.matches || !running });
    invalidate();
  });

  new MutationObserver(() => {
    const next = isDark();
    if (next === dark) return;
    dark = next;
    world.setDark?.(dark);
    invalidate();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  new ResizeObserver(resize).observe(canvas);

  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
      invalidate();
    },
    { passive: true },
  );

  window.addEventListener(
    "scroll",
    () => {
      scroll = readScroll();
      invalidate();
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", invalidate);
  canvas.addEventListener("webglcontextrestored", invalidate);

  return {
    setRunning(on) {
      if (on === running) return;
      running = on;
      if (on) {
        resize();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    },
    get frames() {
      return frames;
    },
  };
}
