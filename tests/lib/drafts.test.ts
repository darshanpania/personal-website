import { describe, expect, it } from "vitest";
import { isListed, showDrafts } from "../../src/lib/drafts";

describe("drafts", () => {
  it("shows drafts only on preview builds", () => {
    expect(showDrafts("preview")).toBe(true);
    expect(showDrafts("production")).toBe(false);
    expect(showDrafts("development")).toBe(false);
    expect(showDrafts(undefined)).toBe(false);
  });

  it("always lists published posts", () => {
    expect(isListed({ draft: false }, "production")).toBe(true);
    expect(isListed({}, "production")).toBe(true);
  });

  it("lists a draft on preview but not in production", () => {
    expect(isListed({ draft: true }, "preview")).toBe(true);
    expect(isListed({ draft: true }, "production")).toBe(false);
  });
});
