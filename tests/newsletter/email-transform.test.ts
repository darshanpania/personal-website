import { describe, expect, it } from "vitest";
import { transformEmailHtml } from "../../scripts/lib/email-transform.mjs";

const OPTS = {
  siteUrl: "https://darshanpania.me",
  postUrl: "https://darshanpania.me/blog/test-post/",
};

const page = (body: string, style = "p { color: #1a1a1a; }") =>
  `<html><head><style>${style}</style></head><body>${body}</body></html>`;

describe("transformEmailHtml", () => {
  it("absolutizes relative href and src", () => {
    const out = transformEmailHtml(
      page(`<a href="/blog/other/">x</a><img src="/images/posts/a.png">`),
      OPTS,
    );
    expect(out).toContain('href="https://darshanpania.me/blog/other/"');
    expect(out).toContain('src="https://darshanpania.me/images/posts/a.png"');
  });

  it("leaves absolute, mailto, hash, and merge-tag hrefs alone", () => {
    const out = transformEmailHtml(
      page(
        `<a href="https://example.com/a">a</a>` +
          `<a href="mailto:x@y.z">m</a>` +
          `<a href="#section">h</a>` +
          `<a href="{{unsubscribe}}">u</a>`,
      ),
      OPTS,
    );
    expect(out).toContain('href="https://example.com/a"');
    expect(out).toContain('href="mailto:x@y.z"');
    expect(out).toContain('href="#section"');
    expect(out).toContain('href="{{unsubscribe}}"');
  });

  it("resolves page-relative URLs against the post URL", () => {
    const out = transformEmailHtml(page(`<a href="guide/">g</a>`), OPTS);
    expect(out).toContain('href="https://darshanpania.me/blog/test-post/guide/"');
  });

  it("normalizes protocol-relative URLs without corrupting the host", () => {
    const out = transformEmailHtml(
      page(`<img src="//cdn.example.com/image.png">`),
      OPTS,
    );
    expect(out).toContain('src="https://cdn.example.com/image.png"');
  });

  it("leaves data: URLs untouched", () => {
    const out = transformEmailHtml(
      page(`<img src="data:image/png;base64,AAAA">`),
      OPTS,
    );
    expect(out).toContain('src="data:image/png;base64,AAAA"');
  });

  it("inlines styles from the style block", () => {
    const out = transformEmailHtml(page(`<p>hello</p>`), OPTS);
    expect(out).toMatch(/<p style="[^"]*color:\s*#1a1a1a/);
  });

  it("strips script tags entirely", () => {
    const out = transformEmailHtml(
      page(`<p>ok</p><script>alert(1)</script>`),
      OPTS,
    );
    expect(out).not.toContain("<script");
    expect(out).toContain("ok");
  });

  it("replaces embeds with a link to the post", () => {
    const out = transformEmailHtml(
      page(`<iframe src="https://youtube.com/embed/abc"></iframe>`),
      OPTS,
    );
    expect(out).not.toContain("<iframe");
    expect(out).toContain(`href="${OPTS.postUrl}"`);
    expect(out).toContain("view this on the site");
  });

  it("keeps preheader text in the output", () => {
    const out = transformEmailHtml(
      page(`<div class="preheader">the preview snippet</div><p>body</p>`),
      OPTS,
    );
    expect(out).toContain("the preview snippet");
  });
});
