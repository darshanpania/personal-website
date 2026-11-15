import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { Stop } from "./stops";

/** What the engine gives a theme on each frame. */
export interface Frame {
  /** Seconds the world has been drawing. It stops while the tab is hidden. */
  time: number;
  /** Seconds since the last frame, capped at 0.05. */
  dt: number;
  /** Pointer position in the viewport, -1..1 on each axis, y up. */
  pointer: { x: number; y: number };
  /** Scroll progress of the current page, 0..1. */
  scroll: number;
}

export interface WorldContext {
  renderer: WebGLRenderer;
  /** The visitor prefers reduced motion: cut to places, do not fly. */
  reducedMotion: boolean;
  /** The site is in dark mode right now. */
  dark: boolean;
  /** Width divided by height of the canvas. */
  aspect: number;
  /** Ask for one more frame, for example after a texture or model loads. */
  invalidate(): void;
}

/**
 * A theme owns the scene and the camera. The engine owns the renderer, the
 * frame loop, and the bridge to the site (routes, dark mode, resize).
 */
export interface WorldTheme {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Move the camera to the stop of the current page. */
  goTo(stop: Stop, options: { instant: boolean }): void;
  /** Advance the scene. Return true while something still moves. */
  update(frame: Frame): boolean;
  resize?(aspect: number): void;
  setDark?(dark: boolean): void;
  dispose(): void;
}

export type ThemeFactory = (ctx: WorldContext) => WorldTheme | Promise<WorldTheme>;
