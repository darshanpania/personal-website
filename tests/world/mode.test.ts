import { describe, expect, it } from "vitest";
import { decideMode, MIN_DEVICE_MEMORY, type ModeEnv } from "../../src/world/mode";

const capable: ModeEnv = {
  stored: null,
  webgl: true,
  reducedMotion: false,
  saveData: false,
};

describe("decideMode", () => {
  it("gives a capable device the 3D world", () => {
    expect(decideMode(capable)).toBe("3d");
    expect(decideMode({ ...capable, deviceMemory: 8 })).toBe("3d");
  });

  it("falls back to lite without WebGL2, even with a saved 3D choice", () => {
    expect(decideMode({ ...capable, webgl: false })).toBe("lite");
    expect(decideMode({ ...capable, webgl: false, stored: "3d" })).toBe("lite");
  });

  it("defaults to lite for reduced motion", () => {
    expect(decideMode({ ...capable, reducedMotion: true })).toBe("lite");
  });

  it("defaults to lite when the visitor saves data", () => {
    expect(decideMode({ ...capable, saveData: true })).toBe("lite");
  });

  it("defaults to lite on a low-memory device", () => {
    expect(decideMode({ ...capable, deviceMemory: MIN_DEVICE_MEMORY - 2 })).toBe("lite");
    expect(decideMode({ ...capable, deviceMemory: MIN_DEVICE_MEMORY })).toBe("3d");
  });

  it("lets a saved choice win over the defaults", () => {
    const weak = { ...capable, reducedMotion: true, saveData: true, deviceMemory: 1 };
    expect(decideMode({ ...weak, stored: "3d" })).toBe("3d");
    expect(decideMode({ ...capable, stored: "lite" })).toBe("lite");
  });

  it("ignores a saved value it does not know", () => {
    expect(decideMode({ ...capable, stored: "banana" })).toBe("3d");
    expect(decideMode({ ...capable, stored: "", reducedMotion: true })).toBe("lite");
  });
});
