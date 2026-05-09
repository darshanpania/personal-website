import { describe, expect, it } from "vitest";
import {
  callAutoSendCampaign,
  constantTimeEquals,
  markdownToHtml,
  parseSendBody,
} from "../../src/lib/send-newsletter";
import { inlineStyles, renderPostEmail } from "../../src/lib/email-template";

describe("parseSendBody", () => {
  it("accepts a well-formed slug and defaults dryRun to false", () => {
    const result = parseSendBody({ slug: "smarter-tools-dumber-us" });
    expect(result).toEqual({
      ok: true,
      body: { slug: "smarter-tools-dumber-us", dryRun: false },
    });
  });

  it("preserves dryRun=true", () => {
    const result = parseSendBody({ slug: "post", dryRun: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.dryRun).toBe(true);
  });

  it("ignores non-boolean dryRun (defaults to false)", () => {
    const result = parseSendBody({ slug: "post", dryRun: "true" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.dryRun).toBe(false);
  });

  it("rejects empty/missing slug", () => {
    expect(parseSendBody({ slug: "" })).toEqual({ ok: false, error: "invalid_slug" });
    expect(parseSendBody({})).toEqual({ ok: false, error: "invalid_slug" });
  });

  it("rejects slugs with path traversal or unsafe chars", () => {
    expect(parseSendBody({ slug: "../etc/passwd" })).toEqual({ ok: false, error: "invalid_slug" });
    expect(parseSendBody({ slug: "post with spaces" })).toEqual({ ok: false, error: "invalid_slug" });
    expect(parseSendBody({ slug: "/absolute" })).toEqual({ ok: false, error: "invalid_slug" });
  });

  it("rejects non-object input", () => {
    expect(parseSendBody(null)).toEqual({ ok: false, error: "invalid_slug" });
    expect(parseSendBody("smarter-tools")).toEqual({ ok: false, error: "invalid_slug" });
  });
});

describe("constantTimeEquals", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEquals("secret-abc", "secret-abc")).toBe(true);
  });
  it("returns false for differing strings of equal length", () => {
    expect(constantTimeEquals("secret-abc", "secret-xyz")).toBe(false);
  });
  it("returns false for differing lengths", () => {
    expect(constantTimeEquals("short", "longer-string")).toBe(false);
  });
});

describe("markdownToHtml", () => {
  it("renders headings, paragraphs, and links", () => {
    const html = markdownToHtml("# Hello\n\nThis is a [link](https://example.com).");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<p");
  });

  it("renders code blocks", () => {
    const html = markdownToHtml("```\nconst x = 1;\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
  });
});

describe("inlineStyles", () => {
  it("adds inline style attributes to known tags", () => {
    const out = inlineStyles("<h2>Title</h2><p>Body <a href=\"x\">link</a></p>");
    expect(out).toContain("<h2 style=");
    expect(out).toContain("<p style=");
    expect(out).toContain("<a style=");
    expect(out).toContain("color:#3d5a80");
  });
});

describe("renderPostEmail", () => {
  const baseInput = {
    title: "Smarter Tools, Dumber Us",
    date: new Date("2026-05-03T00:00:00Z"),
    slug: "smarter-tools-dumber-us",
    bodyHtml: "<p>Some body text.</p>",
  };

  it("includes the title, formatted date, and post URL footer", () => {
    const html = renderPostEmail(baseInput);
    expect(html).toContain("<title>Smarter Tools, Dumber Us</title>");
    expect(html).toContain("May 3, 2026");
    expect(html).toContain("https://darshanpania.me/blog/smarter-tools-dumber-us");
    expect(html).toContain("read this on darshanpania.me");
  });

  it("escapes HTML in the title to avoid breaking the document", () => {
    const html = renderPostEmail({ ...baseInput, title: "A <script>x</script>" });
    expect(html).toContain("A &lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x</script>");
  });

  it("includes an unsubscribe placeholder for AutoSend to substitute", () => {
    const html = renderPostEmail(baseInput);
    expect(html).toContain("{{unsubscribe_url}}");
  });

  it("inlines the cover image as an absolute URL when provided", () => {
    const html = renderPostEmail({
      ...baseInput,
      coverImage: "/images/posts/cover.png",
    });
    expect(html).toContain('src="https://darshanpania.me/images/posts/cover.png"');
  });

  it("uses Geist Sans with system fallbacks in the body font-family", () => {
    const html = renderPostEmail(baseInput);
    expect(html).toMatch(/font-family:'Geist Sans', system-ui/);
  });

  it("respects a custom siteUrl", () => {
    const html = renderPostEmail({ ...baseInput, siteUrl: "https://preview.example.com/" });
    expect(html).toContain("https://preview.example.com/blog/smarter-tools-dumber-us");
  });
});

describe("callAutoSendCampaign", () => {
  const deps = (fetchImpl: typeof fetch) => ({
    apiKey: "test-key",
    listId: "list-real",
    fetchImpl,
    timeoutMs: 1_000,
  });

  it("posts to /v1/campaigns with bearer auth and the expected payload", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchMock = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;

    await callAutoSendCampaign(
      { name: "blog: foo", subject: "Foo", html: "<p>hi</p>" },
      deps(fetchMock),
    );
    expect(captured).not.toBeNull();
    expect(captured!.url).toBe("https://api.autosend.com/v1/campaigns");
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(captured!.init.body as string)).toEqual({
      name: "blog: foo",
      subject: "Foo",
      htmlTemplate: "<p>hi</p>",
      toLists: ["list-real"],
      sendMode: "immediate",
    });
  });

  it("returns ok on a 2xx response", async () => {
    const fetchMock = (async () => new Response("{}", { status: 200 })) as typeof fetch;
    const result = await callAutoSendCampaign(
      { name: "n", subject: "s", html: "<p>x</p>" },
      deps(fetchMock),
    );
    expect(result).toEqual({ ok: true });
  });

  it("targets the dry-run list when constructed with that listId", async () => {
    let body: string | null = null;
    const fetchMock = (async (_url: string, init: RequestInit) => {
      body = init.body as string;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await callAutoSendCampaign(
      { name: "n", subject: "s", html: "<p>x</p>" },
      { ...deps(fetchMock), listId: "list-dryrun" },
    );
    expect(JSON.parse(body!).toLists).toEqual(["list-dryrun"]);
  });

  it("maps a 4xx upstream response to invalid", async () => {
    const fetchMock = (async () => new Response("bad", { status: 422 })) as typeof fetch;
    const result = await callAutoSendCampaign(
      { name: "n", subject: "s", html: "<p>x</p>" },
      deps(fetchMock),
    );
    expect(result).toEqual({ ok: false, error: "invalid" });
  });

  it("maps a 5xx upstream response to upstream", async () => {
    const fetchMock = (async () => new Response("boom", { status: 503 })) as typeof fetch;
    const result = await callAutoSendCampaign(
      { name: "n", subject: "s", html: "<p>x</p>" },
      deps(fetchMock),
    );
    expect(result).toEqual({ ok: false, error: "upstream" });
  });

  it("maps fetch throws to upstream", async () => {
    const fetchMock = (async () => {
      throw new Error("connection refused");
    }) as typeof fetch;
    const result = await callAutoSendCampaign(
      { name: "n", subject: "s", html: "<p>x</p>" },
      deps(fetchMock),
    );
    expect(result).toEqual({ ok: false, error: "upstream" });
  });
});
