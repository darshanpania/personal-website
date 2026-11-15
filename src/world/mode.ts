/**
 * Which version of the site a visitor gets: the 3D world, or the lite
 * (typographic) site. The lite site is always in the HTML; the 3D world is
 * an extra layer that loads on top of it.
 */

export type WorldMode = "3d" | "lite";

export const STORAGE_KEY = "world";

/** Below this much device memory (GB) the lite site is the default. */
export const MIN_DEVICE_MEMORY = 4;

export interface ModeEnv {
  /** The choice the visitor saved earlier, if any. */
  stored: string | null;
  /** The browser can create a WebGL2 context. */
  webgl: boolean;
  /** `prefers-reduced-motion: reduce` is set. */
  reducedMotion: boolean;
  /** The visitor asked the browser to save data. */
  saveData: boolean;
  /** `navigator.deviceMemory` in GB. Chromium only. */
  deviceMemory?: number;
}

/**
 * Rules, in order:
 * 1. No WebGL2: lite. Nothing can override this.
 * 2. A saved choice wins over every default.
 * 3. Reduced motion, data saver, or a low-memory device: lite.
 * 4. Otherwise: 3D.
 */
export function decideMode(env: ModeEnv): WorldMode {
  if (!env.webgl) return "lite";
  if (env.stored === "3d" || env.stored === "lite") return env.stored;
  if (env.reducedMotion || env.saveData) return "lite";
  if (env.deviceMemory !== undefined && env.deviceMemory < MIN_DEVICE_MEMORY) return "lite";
  return "3d";
}

/** Read the inputs for `decideMode` from the browser. */
export function readEnv(): ModeEnv {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage blocked — use the defaults */
  }
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  return {
    stored,
    webgl: typeof WebGL2RenderingContext !== "undefined",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: nav.connection?.saveData === true,
    deviceMemory: nav.deviceMemory,
  };
}

export function storeMode(mode: WorldMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage blocked — the choice lasts for this visit only */
  }
}
