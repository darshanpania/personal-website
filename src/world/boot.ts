/**
 * Entry point of the 3D world. This file is small and loads with every page.
 * It decides between the 3D world and the lite site, and loads the engine
 * (three.js and the scene) only when the visitor gets the 3D world.
 */
import type { WorldHandle } from "./engine";
import { decideMode, readEnv, storeMode, type WorldMode } from "./mode";

let mode: WorldMode = "lite";
let decided = false;
/** WebGL2 exists and has not failed. Without it the switch stays hidden. */
let available = false;
/** The first frame is on the canvas, so the canvas is safe to show. */
let drawn = false;
let engine: Promise<WorldHandle | null> | null = null;

/** Make the page match the state. Safe to call at any time. */
const sync = () => {
  document.documentElement.classList.toggle("world-on", mode === "3d" && drawn);
  const button = document.getElementById("world-toggle");
  if (!button) return;
  button.hidden = !available;
  button.setAttribute("aria-pressed", String(mode === "3d"));
  const state = button.querySelector("[data-world-state]");
  if (state) state.textContent = mode === "3d" ? "on" : "off";
};

const load = () => {
  engine ??= (async () => {
    const canvas = document.getElementById("world");
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    try {
      const [{ startWorld }, { createTheme }] = await Promise.all([
        import("./engine"),
        import("./themes/placeholder"),
      ]);
      const handle = await startWorld(canvas, createTheme);
      drawn = true;
      return handle;
    } catch (error) {
      console.warn("[world] 3D did not start. The lite site stays on.", error);
      available = false;
      mode = "lite";
      return null;
    }
  })();
  return engine;
};

/** Bring the engine in line with the mode, then update the page. */
const apply = () => {
  if (mode === "lite" && !engine) {
    sync();
    return;
  }
  void load().then((handle) => {
    handle?.setRunning(mode === "3d");
    sync();
  });
};

const whenIdle = (run: () => void) => {
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 200);
};

document.addEventListener("astro:page-load", () => {
  if (!decided) {
    decided = true;
    const env = readEnv();
    available = env.webgl;
    mode = decideMode(env);
    // The text of the page comes first. The world loads when the browser is idle.
    if (mode === "3d") whenIdle(apply);
  }
  sync();
});

// View transitions replace the attributes of <html> — put the class back
// in the same step, so the canvas does not blink between pages.
document.addEventListener("astro:after-swap", sync);

// Delegated handler on the document, so the switch keeps working after
// view transitions replace the button.
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest("#world-toggle")) return;
  mode = mode === "3d" ? "lite" : "3d";
  storeMode(mode);
  sync();
  apply();
});
