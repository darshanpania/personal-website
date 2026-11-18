// Decides between the 3D shelf and the flat one.

export type ShelfMode = "3d" | "flat";
export type ShelfQuality = "high" | "low";

export interface DeviceFacts {
  /** The visitor's saved choice, or a `?shelf=` override. */
  choice: string | null;
  webgl2: boolean;
  /** Unmasked renderer string, when the browser gives one. */
  renderer: string;
  reducedMotion: boolean;
  saveData: boolean;
  memoryGb: number | undefined;
  cores: number | undefined;
  coarsePointer: boolean;
  screenWidth: number;
}

const SOFTWARE = /swiftshader|llvmpipe|software|microsoft basic render/i;

export function decideMode(d: DeviceFacts): ShelfMode {
  if (!d.webgl2) return "flat";
  if (d.choice === "3d" || d.choice === "flat") return d.choice;
  if (d.reducedMotion || d.saveData) return "flat";
  if (SOFTWARE.test(d.renderer)) return "flat";
  if (d.memoryGb !== undefined && d.memoryGb <= 2) return "flat";
  if (d.cores !== undefined && d.cores <= 2) return "flat";
  return "3d";
}

/** Phones and tablets get the 3D shelf without ambient occlusion and with smaller shadows. */
export function decideQuality(d: DeviceFacts): ShelfQuality {
  if (d.coarsePointer || d.screenWidth < 700) return "low";
  if (d.memoryGb !== undefined && d.memoryGb <= 4) return "low";
  if (d.cores !== undefined && d.cores <= 4) return "low";
  if (SOFTWARE.test(d.renderer)) return "low";
  return "high";
}
