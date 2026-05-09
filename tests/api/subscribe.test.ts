import { describe, expect, it } from "vitest";
import {
  callAutoSend,
  createRateLimiter,
  isValidEmail,
  parseBody,
} from "../../src/lib/subscribe";

describe("isValidEmail", () => {
  it("accepts a typical email", () => {
    expect(isValidEmail("reader@example.com")).toBe(true);
  });

  it("rejects a missing domain", () => {
    expect(isValidEmail("reader@")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(isValidEmail("reader @example.com")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });

  it("rejects emails over 254 chars", () => {
    const huge = "a".repeat(250) + "@x.io";
    expect(isValidEmail(huge)).toBe(false);
  });
});

describe("parseBody", () => {
  it("returns honeypot when website field is filled", () => {
    const result = parseBody({
      email: "reader@example.com",
      source: "modal",
      slug: "post",
      website: "spambot",
    });
    expect(result).toEqual({ ok: false, error: "honeypot" });
  });

  it("returns invalid_email for missing email", () => {
    const result = parseBody({ source: "modal", slug: "post", website: "" });
    expect(result).toEqual({ ok: false, error: "invalid_email" });
  });

  it("normalizes source and trims a long slug", () => {
    const result = parseBody({
      email: "reader@example.com",
      source: "garbage",
      slug: "x".repeat(500),
      website: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.source).toBe("inline");
      expect(result.body.slug.length).toBe(200);
    }
  });

  it("accepts a well-formed body and defaults firstName to empty", () => {
    const result = parseBody({
      email: "reader@example.com",
      source: "modal",
      slug: "post",
      website: "",
    });
    expect(result).toEqual({
      ok: true,
      body: {
        email: "reader@example.com",
        firstName: "",
        source: "modal",
        slug: "post",
        website: "",
      },
    });
  });

  it("trims and length-caps firstName", () => {
    const result = parseBody({
      email: "reader@example.com",
      firstName: "  Darshan  ",
      source: "modal",
      slug: "post",
      website: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.firstName).toBe("Darshan");

    const long = parseBody({
      email: "reader@example.com",
      firstName: "x".repeat(500),
      source: "modal",
      slug: "post",
      website: "",
    });
    expect(long.ok).toBe(true);
    if (long.ok) expect(long.body.firstName.length).toBe(100);
  });

  it("rejects non-object input", () => {
    expect(parseBody(null)).toEqual({ ok: false, error: "invalid_email" });
    expect(parseBody("string")).toEqual({ ok: false, error: "invalid_email" });
  });
});

describe("createRateLimiter", () => {
  it("allows up to 5 requests per IP per minute", () => {
    const limit = createRateLimiter();
    const now = 1_000_000;
    expect(limit("1.2.3.4", now)).toBe(true);
    expect(limit("1.2.3.4", now + 100)).toBe(true);
    expect(limit("1.2.3.4", now + 200)).toBe(true);
    expect(limit("1.2.3.4", now + 300)).toBe(true);
    expect(limit("1.2.3.4", now + 400)).toBe(true);
    expect(limit("1.2.3.4", now + 500)).toBe(false);
  });

  it("isolates buckets per IP", () => {
    const limit = createRateLimiter();
    const now = 2_000_000;
    for (let i = 0; i < 5; i++) limit("1.2.3.4", now + i);
    expect(limit("1.2.3.4", now + 5)).toBe(false);
    expect(limit("5.6.7.8", now + 5)).toBe(true);
  });

  it("resets after the window expires", () => {
    const limit = createRateLimiter();
    const now = 3_000_000;
    for (let i = 0; i < 5; i++) limit("1.2.3.4", now + i);
    expect(limit("1.2.3.4", now + 60_001)).toBe(true);
  });
});

describe("callAutoSend", () => {
  const deps = (fetchImpl: typeof fetch) => ({
    apiKey: "test-key",
    listId: "list-123",
    fetchImpl,
    timeoutMs: 1_000,
  });

  it("returns ok on a 2xx response", async () => {
    const fetchMock = (async () =>
      new Response(JSON.stringify({ id: "abc" }), { status: 200 })) as typeof fetch;
    const result = await callAutoSend("reader@example.com", "", deps(fetchMock));
    expect(result).toEqual({ ok: true });
  });

  it("includes firstName when provided; bearer auth in headers", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchMock = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await callAutoSend("reader@example.com", "Darshan", deps(fetchMock));
    expect(captured).not.toBeNull();
    expect(captured!.url).toBe("https://api.autosend.com/v1/contacts/email");
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(captured!.init.body as string)).toEqual({
      email: "reader@example.com",
      firstName: "Darshan",
      listIds: ["list-123"],
    });
  });

  it("omits firstName entirely when blank (avoids AutoSend Jane/Smith default)", async () => {
    let captured: RequestInit | null = null;
    const fetchMock = (async (_url: string, init: RequestInit) => {
      captured = init;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await callAutoSend("reader@example.com", "", deps(fetchMock));
    const body = JSON.parse(captured!.body as string);
    expect(body).toEqual({
      email: "reader@example.com",
      listIds: ["list-123"],
    });
    expect(body).not.toHaveProperty("firstName");
    expect(body).not.toHaveProperty("lastName");
  });

  it("maps a 4xx upstream response to invalid_email", async () => {
    const fetchMock = (async () =>
      new Response("bad email", { status: 400 })) as typeof fetch;
    const result = await callAutoSend("reader@example.com", "", deps(fetchMock));
    expect(result).toEqual({ ok: false, error: "invalid_email" });
  });

  it("maps a 5xx upstream response to upstream", async () => {
    const fetchMock = (async () =>
      new Response("server boom", { status: 502 })) as typeof fetch;
    const result = await callAutoSend("reader@example.com", "", deps(fetchMock));
    expect(result).toEqual({ ok: false, error: "upstream" });
  });

  it("maps fetch throws to upstream", async () => {
    const fetchMock = (async () => {
      throw new Error("connection refused");
    }) as typeof fetch;
    const result = await callAutoSend("reader@example.com", "", deps(fetchMock));
    expect(result).toEqual({ ok: false, error: "upstream" });
  });
});
