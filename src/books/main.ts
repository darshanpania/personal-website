// Entry for /books. The page is server-rendered as a flat shelf that works
// everywhere; this script swaps in the 3D shelf when the device can draw it.
import type { Book } from "./layout";
import { decideMode, decideQuality, type DeviceFacts, type ShelfMode } from "./mode";
import type { Placement, Shelf } from "./scene";

const STORE = "books-shelf";

let shelf: Shelf | null = null;
let cleanup: (() => void) | null = null;

declare global {
  interface Window {
    __shelf?: Shelf & { ready: boolean };
  }
}

function facts(): DeviceFacts {
  let renderer = "";
  let webgl2 = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      webgl2 = true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    /* no WebGL: flat shelf */
  }
  let choice: string | null = new URLSearchParams(location.search).get("shelf");
  if (!choice) {
    try {
      choice = localStorage.getItem(STORE);
    } catch {
      /* storage blocked */
    }
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    choice,
    webgl2,
    renderer,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: !!nav.connection?.saveData,
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    screenWidth: Math.min(screen.width, innerWidth),
  };
}

const meta = (b: Book) =>
  [
    b.series ? `${b.series}${b.seriesIndex ? ` #${b.seriesIndex}` : ""}` : "",
    b.year ? String(b.year) : "",
    b.pages ? `${b.pages} pages` : "",
  ]
    .filter(Boolean)
    .join(" · ");

function fill(el: HTMLElement, b: Book) {
  const set = (name: string, text: string) => {
    const node = el.querySelector<HTMLElement>(`[data-book="${name}"]`);
    if (!node) return;
    node.textContent = text;
    node.hidden = !text;
  };
  set("title", b.title);
  set("author", b.author);
  set("genre", b.genre);
  set("meta", meta(b));
  set("note", b.note ?? "");
  const stars = b.rating ? "★".repeat(b.rating) + "☆".repeat(5 - b.rating) : "";
  set("rating", stars);
  el.querySelector('[data-book="rating"]')?.setAttribute("aria-label", b.rating ? `My rating: ${b.rating} of 5` : "");
}

function init() {
  const root = document.getElementById("bookshelf");
  if (!root || root.dataset.ready) return;
  root.dataset.ready = "true";

  const books: Book[] = JSON.parse(root.dataset.books ?? "[]");
  const byId = new Map(books.map((b) => [b.id, b]));
  const stage = root.querySelector<HTMLElement>("[data-shelf-stage]")!;
  const canvas = stage.querySelector("canvas")!;
  const caption = stage.querySelector<HTMLElement>("[data-shelf-caption]")!;
  const flat = root.querySelector<HTMLElement>("[data-shelf-flat]")!;
  const dialog = root.querySelector<HTMLDialogElement>("[data-shelf-dialog]")!;
  const backdrop = root.querySelector<HTMLElement>("[data-shelf-backdrop]")!;
  const toggle = root.querySelector<HTMLButtonElement>("[data-shelf-toggle]")!;
  const device = facts();
  let mode: ShelfMode = "flat";
  let starting = false;
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement | Document,
    type: K | string,
    fn: (e: Event) => void,
  ) => {
    el.addEventListener(type, fn);
    off.push(() => el.removeEventListener(type, fn));
  };

  // The stage is as wide as the window, not the text column: the floor runs
  // from one side of the page to the other.
  const STAGE_MAX = 1680;
  const bleed = () => {
    const vw = document.documentElement.clientWidth;
    const w = Math.min(vw, STAGE_MAX);
    const left = root.getBoundingClientRect().left;
    stage.style.width = `${w}px`;
    stage.style.marginLeft = `${(vw - w) / 2 - left}px`;
    stage.dataset.capped = String(w < vw);
  };
  bleed();
  window.addEventListener("resize", bleed);
  off.push(() => window.removeEventListener("resize", bleed));

  const showToggle = () => {
    toggle.hidden = !device.webgl2;
    toggle.textContent = mode === "3d" ? "switch to flat shelf" : "switch to 3d shelf";
  };

  const setMode = (next: ShelfMode) => {
    mode = next;
    root.dataset.mode = next;
    stage.hidden = next !== "3d";
    showToggle();
  };

  const onSelect = (book: Book | null, placement: Placement | null) => {
    if (!book || !placement) {
      caption.dataset.open = "false";
      return;
    }
    fill(caption, book);
    caption.dataset.mode = placement.mode;
    caption.style.left = `${placement.left}px`;
    caption.style.top = `${placement.top}px`;
    caption.style.width = `${placement.width}px`;
    caption.style.height = `${placement.height}px`;
    caption.dataset.open = "true";
  };

  const start3d = async () => {
    if (shelf || starting) return;
    starting = true;
    setMode("3d");
    root.dataset.loading = "true";
    try {
      const { createShelf, DIM } = await import("./scene");
      if (!document.body.contains(root)) return;
      shelf = await createShelf(stage, canvas, books, {
        quality: (new URLSearchParams(location.search).get("quality") as "high" | "low" | null) ?? decideQuality(device),
        dark: document.documentElement.classList.contains("dark"),
        onSelect,
        onDim: (amount) => {
          backdrop.style.opacity = String(amount * DIM);
          root.style.setProperty("--dim", String(amount * DIM));
          root.dataset.open = amount > 0.001 ? "true" : "false";
        },
      });
      window.__shelf = Object.assign(shelf, { ready: true });
    } catch (err) {
      console.warn("[books] 3D shelf failed, using the flat shelf", err);
      stop3d();
      device.webgl2 = false;
      setMode("flat");
    } finally {
      starting = false;
      delete root.dataset.loading;
    }
  };

  const stop3d = () => {
    shelf?.dispose();
    shelf = null;
    delete window.__shelf;
    caption.dataset.open = "false";
    backdrop.style.opacity = "0";
    root.style.setProperty("--dim", "0");
    root.dataset.open = "false";
  };

  const openFlat = (b: Book) => {
    fill(dialog, b);
    const img = dialog.querySelector<HTMLImageElement>("[data-book='cover']")!;
    const plain = dialog.querySelector<HTMLElement>("[data-book='plain']")!;
    img.hidden = !b.cover;
    plain.hidden = !!b.cover;
    if (b.cover) {
      img.src = b.cover;
      img.alt = `Cover of ${b.title}`;
    } else {
      plain.style.background = b.spine.bg;
      plain.style.color = b.spine.fg;
      plain.textContent = b.title;
    }
    dialog.showModal();
  };

  // The flat shelf stays in the page in 3D mode, hidden from sight, so the
  // books are still reachable by keyboard and screen reader.
  on(flat, "click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-book-id]");
    const book = btn && byId.get(btn.dataset.bookId!);
    if (!book) return;
    if (mode === "3d" && shelf) {
      shelf.select(shelf.selected() === book.id ? null : book.id);
      stage.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else openFlat(book);
  });
  on(dialog, "click", (e) => {
    if (e.target === dialog || (e.target as HTMLElement).closest("[data-shelf-close]")) dialog.close();
  });
  on(caption, "click", (e) => {
    if ((e.target as HTMLElement).closest("[data-shelf-close]")) shelf?.select(null);
  });
  on(backdrop, "click", () => shelf?.select(null));
  on(document, "keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && shelf?.selected()) shelf.select(null);
  });
  on(toggle, "click", () => {
    const next: ShelfMode = mode === "3d" ? "flat" : "3d";
    try {
      localStorage.setItem(STORE, next);
    } catch {
      /* storage blocked */
    }
    if (next === "3d") void start3d();
    else {
      stop3d();
      setMode("flat");
    }
  });

  const themeWatch = new MutationObserver(() =>
    shelf?.setTheme(document.documentElement.classList.contains("dark")),
  );
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  cleanup = () => {
    themeWatch.disconnect();
    for (const fn of off) fn();
    stop3d();
  };

  setMode("flat");
  if (decideMode(device) === "3d") void start3d();
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  cleanup?.();
  cleanup = null;
});
