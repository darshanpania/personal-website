import { describe, expect, it } from "vitest";
import { stopFor, STOPS } from "../../src/world/stops";

describe("stopFor", () => {
  it("maps each top-level page to its stop", () => {
    expect(stopFor("/")).toBe("home");
    expect(stopFor("/blog")).toBe("blog");
    expect(stopFor("/projects")).toBe("projects");
    expect(stopFor("/resume")).toBe("resume");
    expect(stopFor("/contact")).toBe("contact");
  });

  it("ignores a trailing slash", () => {
    expect(stopFor("/blog/")).toBe("blog");
    expect(stopFor("/contact/")).toBe("contact");
    expect(stopFor("")).toBe("home");
  });

  it("sends every post to the post stop", () => {
    expect(stopFor("/blog/the-library")).toBe("post");
    expect(stopFor("/blog/2026/some-post/")).toBe("post");
  });

  it("does not confuse a page that only starts with a known name", () => {
    expect(stopFor("/blogroll")).toBe("other");
    expect(stopFor("/projects/fplguru")).toBe("other");
  });

  it("sends every other page to the fallback stop", () => {
    expect(stopFor("/404")).toBe("other");
    expect(stopFor("/subscribed")).toBe("other");
    expect(stopFor("/newsletter/2026-01")).toBe("other");
  });

  it("only returns stops from the list", () => {
    for (const path of ["/", "/blog", "/blog/x", "/projects", "/resume", "/contact", "/x"]) {
      expect(STOPS).toContain(stopFor(path));
    }
  });
});
