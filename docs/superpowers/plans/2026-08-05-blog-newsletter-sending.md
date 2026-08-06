# Blog → Newsletter Sending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a new internal blog post merges to `main`, a GitHub Action creates a draft Autosend campaign (full post as email HTML) and sends a test email to Darshan, who approves the real send.

**Architecture:** A prerendered Astro route (`/newsletter/<slug>/`) reuses the site's MDX pipeline to emit email-shaped HTML at build time. A Node script transforms that HTML (absolute URLs, inlined CSS, scripts stripped) and drives the Autosend REST API: idempotency check by campaign name, create draft campaign, send test email. A GitHub Action triggers the script for post files *added* by pushes to `main`.

**Tech Stack:** Astro 5 (existing), Node 22 ESM scripts, `cheerio` + `juice` + `gray-matter` (dev deps), Vitest 4 (existing), GitHub Actions, Autosend REST API v1.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-05-blog-newsletter-sending-design.md`
- Campaign naming convention: `blog: <slug>` (exact string, used for idempotency)
- Campaigns are ALWAYS created as drafts: never set `publish`, `sendNow`, or `scheduledAt` on `POST /v1/campaigns`
- Sender: `musings@darshanpania.me`, reply-to `darshanpania@gmail.com`
- Test email recipient: `darshanpania@gmail.com` (via `NEWSLETTER_TEST_EMAIL` env)
- Site URL: `https://darshanpania.me` (no trailing slash in constants)
- Email HTML: single column, max-width 600px, light-theme colors only, no JS
- Never log email addresses or API response bodies in CI (slugs, campaign ids, status codes only)
- Autosend API base: `https://api.autosend.com/v1`, bearer auth
- `{{unsubscribe}}` is Autosend's merge tag — it must survive the HTML transform untouched
- `previewText` max 140 chars
- All new scripts are ESM (`.mjs`); repo has `"type": "module"`

## Autosend REST endpoints used (verified from docs.autosend.com)

| Purpose | Endpoint | Notes |
|---|---|---|
| List campaigns | `GET /v1/campaigns?name=<q>&limit=100` | `name` is partial match → exact-compare client-side |
| Create draft campaign | `POST /v1/campaigns` | `{name, subject, previewText, fromSenderId, replyTo, htmlTemplate, toLists, unsubscribeGroupId, trackingClick, trackingOpen}`; draft when `publish`/`sendNow`/`scheduledAt` omitted |
| Send test email | `POST /v1/mails/send` | `{to, from, subject, html, replyTo, unsubscribeGroupId}` |

---

### Task 1: Email rendering route `/newsletter/<slug>/`

**Files:**
- Create: `src/pages/newsletter/[...slug].astro`
- Modify: `astro.config.mjs` (sitemap filter)
- Modify: `public/robots.txt` (disallow)

**Interfaces:**
- Consumes: `posts` content collection (schema in `src/content.config.ts`: `title`, `date`, `category`, `description?`, `coverImage?`, `draft`)
- Produces: built file `dist/client/newsletter/<slug>/index.html` for every non-draft post — a full HTML document containing `<style>` in head, a hidden preheader div with the post description, an `<a href="{{unsubscribe}}">` link in the footer, and `data-newsletter-body` on the post-content wrapper. Task 4 reads this file.

- [ ] **Step 1: Write the route**

Create `src/pages/newsletter/[...slug].astro`:

```astro
---
// Email-shaped rendering of each internal post, consumed by
// scripts/newsletter-draft.mjs. Not a site page: no layout, no site CSS,
// light-theme only, noindex.
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);

const site = (Astro.site?.href ?? "https://darshanpania.me").replace(/\/$/, "");
const postUrl = `${site}/blog/${post.id}/`;

const fmt = (d: Date) =>
  `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

const preheader = post.data.description ?? "";
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>{post.data.title}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f6f6f4;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          Helvetica, Arial, sans-serif;
        color: #1a1a1a;
      }
      .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
      .card { background: #ffffff; border: 1px solid #e2e2de; border-radius: 8px; padding: 32px 28px; }
      .brand { font-size: 13px; letter-spacing: 0.04em; color: #6b6b66; margin: 0 0 20px; }
      .brand a { color: #6b6b66; text-decoration: none; }
      h1.post-title { font-size: 26px; line-height: 1.25; margin: 0 0 6px; }
      .meta { font-size: 13px; color: #6b6b66; margin: 0 0 24px; }
      .meta a { color: #1a5fb4; }
      .cover { width: 100%; height: auto; border-radius: 6px; margin: 0 0 20px; }
      .post-body { font-size: 16px; line-height: 1.65; }
      .post-body h2 { font-size: 21px; margin: 28px 0 10px; }
      .post-body h3 { font-size: 18px; margin: 24px 0 8px; }
      .post-body p { margin: 0 0 16px; }
      .post-body a { color: #1a5fb4; }
      .post-body img { max-width: 100%; height: auto; border-radius: 6px; }
      .post-body blockquote { margin: 0 0 16px; padding: 2px 0 2px 16px; border-left: 3px solid #e2e2de; color: #4a4a46; }
      .post-body pre { background: #22272e; color: #adbac7; padding: 14px 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; line-height: 1.5; }
      .post-body code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .footer { font-size: 12px; color: #6b6b66; text-align: center; padding: 20px 8px 4px; line-height: 1.6; }
      .footer a { color: #6b6b66; }
      .preheader { display: none; max-height: 0; overflow: hidden; mso-hide: all; }
    </style>
  </head>
  <body>
    <div class="preheader">{preheader}</div>
    <div class="wrapper">
      <div class="card">
        <p class="brand"><a href={site}>musings — darshanpania.me</a></p>
        <h1 class="post-title">{post.data.title}</h1>
        <p class="meta">
          {fmt(post.data.date)} · <a href={postUrl}>read on the site →</a>
        </p>
        {post.data.coverImage && (
          <img class="cover" src={post.data.coverImage} alt="" />
        )}
        <div class="post-body" data-newsletter-body>
          <Content />
        </div>
      </div>
      <div class="footer">
        <p>
          you're getting this because you subscribed at
          <a href={site}> darshanpania.me</a>.
        </p>
        <p><a href={"{{unsubscribe}}"}>unsubscribe</a> any time — no hard feelings.</p>
      </div>
    </div>
  </body>
</html>
```

Note: `href={"{{unsubscribe}}"}` — the string expression keeps Astro from parsing the double braces; it renders as `href="{{unsubscribe}}"`.

- [ ] **Step 2: Exclude `/newsletter/` from sitemap**

In `astro.config.mjs`, change the sitemap integration line:

```js
integrations: [
  mdx(),
  sitemap({
    filter: (page) => !page.includes("/newsletter/"),
  }),
],
```

- [ ] **Step 3: Disallow in robots.txt**

`public/robots.txt` becomes:

```
User-agent: *
Allow: /
Disallow: /newsletter/

Sitemap: https://darshanpania.me/sitemap-index.xml
```

- [ ] **Step 4: Build and verify output**

Run: `npm run build && ls dist/client/newsletter/smarter-tools-dumber-us/`
Expected: `index.html` exists. (If dist layout differs, check `dist/newsletter/...` — the Vercel adapter puts static output under `dist/client/`. Whichever exists, note it: Task 4's `builtHtmlPath` uses it.)

Run: `grep -o "{{unsubscribe}}" dist/client/newsletter/smarter-tools-dumber-us/index.html | head -1`
Expected: `{{unsubscribe}}`

Run: `grep -o 'data-newsletter-body' dist/client/newsletter/smarter-tools-dumber-us/index.html`
Expected: `data-newsletter-body`

Also verify the sitemap: `grep -c newsletter dist/client/sitemap-0.xml` → Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add src/pages/newsletter astro.config.mjs public/robots.txt
git commit -m "Add email-shaped /newsletter/<slug> rendering route"
```

---

### Task 2: Pure email HTML transform

**Files:**
- Create: `scripts/lib/email-transform.mjs`
- Test: `tests/newsletter/email-transform.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure function over an HTML string)
- Produces: `transformEmailHtml(html: string, opts: { siteUrl: string; postUrl: string }): string` — absolutizes `href`/`src`, inlines `<style>` via juice, strips `<script>`, replaces `iframe|video|audio|embed|object` with a link to `postUrl`, preserves `{{unsubscribe}}`. Task 4 imports it.

- [ ] **Step 1: Install dev dependencies**

Run: `npm install -D cheerio juice gray-matter`
Expected: added to `devDependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

Create `tests/newsletter/email-transform.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/newsletter/email-transform.test.ts`
Expected: FAIL — cannot find module `scripts/lib/email-transform.mjs`.

- [ ] **Step 4: Implement the transform**

Create `scripts/lib/email-transform.mjs`:

```js
// Pure HTML → email-HTML transform. No I/O, no env — unit-testable.
import * as cheerio from "cheerio";
import juice from "juice";

const SKIP_URL = /^(https?:|mailto:|tel:|#|\{\{)/;

export function transformEmailHtml(html, { siteUrl, postUrl }) {
  const base = siteUrl.replace(/\/$/, "");
  const $ = cheerio.load(html);

  $("script").remove();

  $("iframe, video, audio, embed, object").each((_, el) => {
    $(el).replaceWith(
      `<p><a href="${postUrl}">view this on the site →</a></p>`,
    );
  });

  const absolutize = (attr) => (_, el) => {
    const $el = $(el);
    const val = $el.attr(attr);
    if (!val || SKIP_URL.test(val)) return;
    $el.attr(attr, val.startsWith("/") ? `${base}${val}` : `${base}/${val}`);
  };
  $("[href]").each(absolutize("href"));
  $("[src]").each(absolutize("src"));

  // Inline the <style> block into style="" attributes for client support.
  // preserveMediaQueries keeps any @media rules in a residual <style> tag.
  return juice($.html(), { preserveMediaQueries: true });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/newsletter/email-transform.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/lib/email-transform.mjs tests/newsletter/email-transform.test.ts
git commit -m "Add pure email HTML transform (absolutize, inline, strip)"
```

---

### Task 3: Autosend REST client

**Files:**
- Create: `scripts/lib/autosend.mjs`
- Test: `tests/newsletter/autosend.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces (Task 4 imports all of these):
  - `campaignNameForSlug(slug: string): string` → `` `blog: ${slug}` ``
  - `createClient({ apiKey, fetchImpl?, timeoutMs? })` returning:
    - `findCampaignByName(name) → Promise<object|null>` (exact name match)
    - `createDraftCampaign({ name, subject, previewText, fromSenderId, replyTo, htmlTemplate, listId, unsubscribeGroupId }) → Promise<object>` (returns API `data`)
    - `sendTestEmail({ toEmail, fromEmail, fromName, replyTo, subject, html, unsubscribeGroupId }) → Promise<object>`

- [ ] **Step 1: Write the failing tests**

Create `tests/newsletter/autosend.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  campaignNameForSlug,
  createClient,
} from "../../scripts/lib/autosend.mjs";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, impl: impl as unknown as typeof fetch };
}

describe("campaignNameForSlug", () => {
  it("uses the locked naming convention", () => {
    expect(campaignNameForSlug("my-post")).toBe("blog: my-post");
  });
});

describe("findCampaignByName", () => {
  it("returns the exact-name match from partial-match results", async () => {
    const { calls, impl } = fakeFetch(200, {
      success: true,
      data: {
        campaigns: [
          { id: "1", name: "blog: my-post-part-2" },
          { id: "2", name: "blog: my-post" },
        ],
      },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    const found = await client.findCampaignByName("blog: my-post");
    expect(found?.id).toBe("2");
    expect(calls[0].url).toContain("/v1/campaigns?");
    expect(calls[0].url).toContain("name=blog%3A+my-post");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer k",
    );
  });

  it("returns null when nothing matches exactly", async () => {
    const { impl } = fakeFetch(200, {
      success: true,
      data: { campaigns: [{ id: "1", name: "blog: my-post-part-2" }] },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    expect(await client.findCampaignByName("blog: my-post")).toBeNull();
  });
});

describe("createDraftCampaign", () => {
  it("POSTs a draft (no publish/sendNow/scheduledAt) with the right shape", async () => {
    const { calls, impl } = fakeFetch(200, {
      success: true,
      data: { id: "c1", name: "blog: my-post", status: "draft" },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    const data = await client.createDraftCampaign({
      name: "blog: my-post",
      subject: "My Post",
      previewText: "preview",
      fromSenderId: "s1",
      replyTo: "reply@example.com",
      htmlTemplate: "<html>x</html>",
      listId: "l1",
      unsubscribeGroupId: "g1",
    });
    expect(data.id).toBe("c1");
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toMatch(/\/v1\/campaigns$/);
    expect(calls[0].init.method).toBe("POST");
    expect(body).toMatchObject({
      name: "blog: my-post",
      subject: "My Post",
      previewText: "preview",
      fromSenderId: "s1",
      replyTo: "reply@example.com",
      htmlTemplate: "<html>x</html>",
      toLists: ["l1"],
      unsubscribeGroupId: "g1",
      trackingClick: true,
      trackingOpen: true,
    });
    expect(body.publish).toBeUndefined();
    expect(body.sendNow).toBeUndefined();
    expect(body.scheduledAt).toBeUndefined();
  });
});

describe("sendTestEmail", () => {
  it("POSTs to /v1/mails/send", async () => {
    const { calls, impl } = fakeFetch(200, {
      success: true,
      data: { emailId: "e1" },
    });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    await client.sendTestEmail({
      toEmail: "me@example.com",
      fromEmail: "musings@darshanpania.me",
      fromName: "Darshan Pania",
      replyTo: "reply@example.com",
      subject: "[test] My Post",
      html: "<html>x</html>",
      unsubscribeGroupId: "g1",
    });
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toMatch(/\/v1\/mails\/send$/);
    expect(body.to).toEqual({ email: "me@example.com" });
    expect(body.from).toEqual({
      email: "musings@darshanpania.me",
      name: "Darshan Pania",
    });
    expect(body.subject).toBe("[test] My Post");
  });
});

describe("error handling", () => {
  it("throws with status code but not response body", async () => {
    const { impl } = fakeFetch(500, { secret: "pii" });
    const client = createClient({ apiKey: "k", fetchImpl: impl });
    await expect(client.findCampaignByName("x")).rejects.toThrow(/500/);
    await expect(client.findCampaignByName("x")).rejects.not.toThrow(/pii/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/newsletter/autosend.test.ts`
Expected: FAIL — cannot find module `scripts/lib/autosend.mjs`.

- [ ] **Step 3: Implement the client**

Create `scripts/lib/autosend.mjs`:

```js
// Thin Autosend REST client. No PII in thrown errors or logs — status
// codes and ids only. Endpoints verified against docs.autosend.com.
const BASE = "https://api.autosend.com/v1";

export function campaignNameForSlug(slug) {
  return `blog: ${slug}`;
}

export function createClient({ apiKey, fetchImpl = fetch, timeoutMs = 15000 }) {
  async function request(method, path, { query, body } = {}) {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      url.searchParams.set(k, String(v));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Autosend ${method} ${path} failed: HTTP ${res.status}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async findCampaignByName(name) {
      const json = await request("GET", "/campaigns", {
        query: { name, limit: 100 },
      });
      const campaigns = json?.data?.campaigns ?? [];
      return campaigns.find((c) => c.name === name) ?? null;
    },

    async createDraftCampaign({
      name,
      subject,
      previewText,
      fromSenderId,
      replyTo,
      htmlTemplate,
      listId,
      unsubscribeGroupId,
    }) {
      // Draft on purpose: publish/sendNow/scheduledAt are never set.
      const json = await request("POST", "/campaigns", {
        body: {
          name,
          subject,
          previewText,
          fromSenderId,
          replyTo,
          htmlTemplate,
          toLists: [listId],
          unsubscribeGroupId,
          trackingClick: true,
          trackingOpen: true,
        },
      });
      return json.data;
    },

    async sendTestEmail({
      toEmail,
      fromEmail,
      fromName,
      replyTo,
      subject,
      html,
      unsubscribeGroupId,
    }) {
      const json = await request("POST", "/mails/send", {
        body: {
          to: { email: toEmail },
          from: { email: fromEmail, name: fromName },
          replyTo: { email: replyTo },
          subject,
          html,
          unsubscribeGroupId,
        },
      });
      return json.data;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/newsletter/autosend.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all files pass (existing `tests/api/subscribe.test.ts` + the two new files).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/autosend.mjs tests/newsletter/autosend.test.ts
git commit -m "Add Autosend REST client (find/create draft campaign, test email)"
```

---

### Task 4: Orchestrator script `newsletter-draft.mjs`

**Files:**
- Create: `scripts/newsletter-draft.mjs`
- Modify: `package.json` (add script), `.env.example` (document vars), `.gitignore` (ignore `scripts/out/`)

**Interfaces:**
- Consumes: `transformEmailHtml` (Task 2), `campaignNameForSlug` + `createClient` (Task 3), built HTML from Task 1 at `dist/client/newsletter/<slug>/index.html` (adjust to the path confirmed in Task 1 Step 4)
- Produces: CLI `node scripts/newsletter-draft.mjs <slug> [--dry-run]`; exit 0 on success/skip, non-zero on failure. Dry run writes `scripts/out/<slug>.email.html`. Task 5's workflow invokes this exact CLI.

- [ ] **Step 1: Write the orchestrator**

Create `scripts/newsletter-draft.mjs`:

```js
#!/usr/bin/env node
// Creates a draft Autosend campaign + test email for one post slug.
// Usage: node scripts/newsletter-draft.mjs <slug> [--dry-run]
// Requires a prior `npm run build`. Idempotent by campaign name.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { transformEmailHtml } from "./lib/email-transform.mjs";
import { campaignNameForSlug, createClient } from "./lib/autosend.mjs";

const SITE_URL = process.env.SITE_URL ?? "https://darshanpania.me";
const REPLY_TO = "darshanpania@gmail.com";
const FROM_NAME = "Darshan Pania";

function fail(msg) {
  console.error(`[newsletter-draft] ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) fail("usage: newsletter-draft.mjs <slug> [--dry-run]");

// --- read frontmatter -------------------------------------------------
const postPath = ["mdx", "md"]
  .map((ext) => path.join("src/content/posts", `${slug}.${ext}`))
  .find(existsSync);
if (!postPath) fail(`no post file for slug "${slug}"`);

const { data: fm } = matter(await readFile(postPath, "utf8"));
if (fm.draft) {
  console.log(`[newsletter-draft] "${slug}" is a draft post — skipping`);
  process.exit(0);
}
if (!fm.title) fail(`post "${slug}" has no title`);

// --- read built email HTML -------------------------------------------
const builtHtmlPath = path.join("dist/client/newsletter", slug, "index.html");
if (!existsSync(builtHtmlPath)) {
  console.log(
    `[newsletter-draft] no built HTML at ${builtHtmlPath} — skipping (draft or missing build?)`,
  );
  process.exit(0);
}
const rawHtml = await readFile(builtHtmlPath, "utf8");

// --- transform --------------------------------------------------------
const postUrl = `${SITE_URL}/blog/${slug}/`;
const html = transformEmailHtml(rawHtml, { siteUrl: SITE_URL, postUrl });

const bodyMatch = html.includes("data-newsletter-body");
if (!bodyMatch || html.length < 500) {
  fail(`transformed HTML for "${slug}" looks empty — refusing to draft`);
}

const subject = fm.title;
const previewText = (fm.description ?? "").slice(0, 140);
const name = campaignNameForSlug(slug);

// --- dry run ----------------------------------------------------------
if (dryRun) {
  await mkdir("scripts/out", { recursive: true });
  const outPath = path.join("scripts/out", `${slug}.email.html`);
  await writeFile(outPath, html);
  console.log(`[newsletter-draft] dry run — wrote ${outPath}`);
  console.log(
    `[newsletter-draft] would create draft: name="${name}" subject="${subject}"`,
  );
  process.exit(0);
}

// --- env for the real thing ------------------------------------------
const env = (key) => process.env[key] || fail(`missing env ${key}`);
const client = createClient({ apiKey: env("AUTOSEND_API_KEY") });
const listId = env("AUTOSEND_LIST_ID");
const senderId = env("AUTOSEND_SENDER_ID");
const senderEmail = env("AUTOSEND_SENDER_EMAIL");
const unsubGroupId = env("AUTOSEND_UNSUB_GROUP_ID");
const testEmail = env("NEWSLETTER_TEST_EMAIL");

// --- idempotency check ------------------------------------------------
// Reuse an existing draft instead of exiting: if a prior run created the
// campaign but died before the test email went out, the retry must still
// send it.
let campaign = await client.findCampaignByName(name);
if (campaign) {
  console.log(
    `[newsletter-draft] campaign "${name}" already exists (id ${campaign.id}) — skipping creation`,
  );
} else {
  campaign = await client.createDraftCampaign({
    name,
    subject,
    previewText,
    fromSenderId: senderId,
    replyTo: REPLY_TO,
    htmlTemplate: html,
    listId,
    unsubscribeGroupId: unsubGroupId,
  });
  console.log(`[newsletter-draft] created draft campaign id ${campaign.id}`);
}

await client.sendTestEmail({
  toEmail: testEmail,
  fromEmail: senderEmail,
  fromName: FROM_NAME,
  replyTo: REPLY_TO,
  subject: `[test] ${subject}`,
  html,
  unsubscribeGroupId: unsubGroupId,
});
console.log(`[newsletter-draft] test email sent — go approve the campaign`);
```

- [ ] **Step 2: Wire up package.json and housekeeping**

In `package.json` scripts, add:

```json
"newsletter:draft": "node scripts/newsletter-draft.mjs"
```

Append to `.gitignore`:

```
scripts/out/
```

Append to `.env.example`:

```
# Newsletter drafting (CI / scripts/newsletter-draft.mjs — new darshanpania.me project)
AUTOSEND_SENDER_ID=
AUTOSEND_SENDER_EMAIL=musings@darshanpania.me
AUTOSEND_UNSUB_GROUP_ID=
NEWSLETTER_TEST_EMAIL=
```

(`AUTOSEND_API_KEY` and `AUTOSEND_LIST_ID` are already documented above in the file; they simply switch to the new project's values.)

- [ ] **Step 3: Dry-run against a real post**

Run: `npm run build && npm run newsletter:draft -- smarter-tools-dumber-us --dry-run`
Expected output:

```
[newsletter-draft] dry run — wrote scripts/out/smarter-tools-dumber-us.email.html
[newsletter-draft] would create draft: name="blog: smarter-tools-dumber-us" subject="..."
```

Open `scripts/out/smarter-tools-dumber-us.email.html` and check: inline styles on `<p>` tags, absolute `https://darshanpania.me/...` image URLs, `{{unsubscribe}}` intact in the footer, no `<script>` anywhere (`grep -c "<script" scripts/out/smarter-tools-dumber-us.email.html` → 0).

- [ ] **Step 4: Verify skip paths**

Run: `npm run newsletter:draft -- no-such-post --dry-run; echo "exit: $?"`
Expected: `no post file for slug "no-such-post"` and `exit: 1`.

- [ ] **Step 5: Commit**

```bash
git add scripts/newsletter-draft.mjs package.json .gitignore .env.example
git commit -m "Add newsletter-draft orchestrator with dry-run mode"
```

---

### Task 5: GitHub Action workflow

**Files:**
- Create: `.github/workflows/newsletter-draft.yml`

**Interfaces:**
- Consumes: the CLI from Task 4 (`node scripts/newsletter-draft.mjs <slug>`); repo secrets `AUTOSEND_API_KEY`, `AUTOSEND_LIST_ID`, `AUTOSEND_SENDER_ID`, `AUTOSEND_SENDER_EMAIL`, `AUTOSEND_UNSUB_GROUP_ID`, `NEWSLETTER_TEST_EMAIL` (added in Task 6)
- Produces: on push to `main` that adds post files, a red/green workflow run; one draft campaign + test email per added post

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/newsletter-draft.yml`:

```yaml
name: newsletter-draft

on:
  push:
    branches: [main]
    paths:
      - "src/content/posts/**"

permissions:
  contents: read

jobs:
  draft:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect added posts
        id: added
        run: |
          BEFORE="${{ github.event.before }}"
          # First push / force push edge case: fall back to the parent commit.
          if [ "$BEFORE" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$BEFORE" 2>/dev/null; then
            BEFORE="$(git rev-parse HEAD^)"
          fi
          ADDED=$(git diff --diff-filter=A --name-only "$BEFORE" "${{ github.sha }}" -- 'src/content/posts/*.md' 'src/content/posts/*.mdx' || true)
          # Slug = path minus prefix and extension; keeps nested paths intact.
          SLUGS=$(printf '%s\n' "$ADDED" | sed -nE 's#^src/content/posts/(.+)\.(md|mdx)$#\1#p')
          if [ -n "$SLUGS" ]; then
            {
              echo "slugs<<SLUGS_EOF"
              printf '%s\n' "$SLUGS"
              echo "SLUGS_EOF"
            } >> "$GITHUB_OUTPUT"
          fi
          echo "Added post slugs: ${SLUGS:-none}"

      - name: Set up Node
        if: steps.added.outputs.slugs != ''
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install and build
        if: steps.added.outputs.slugs != ''
        run: |
          npm ci
          npm run build

      - name: Create draft campaigns
        if: steps.added.outputs.slugs != ''
        env:
          AUTOSEND_API_KEY: ${{ secrets.AUTOSEND_API_KEY }}
          AUTOSEND_LIST_ID: ${{ secrets.AUTOSEND_LIST_ID }}
          AUTOSEND_SENDER_ID: ${{ secrets.AUTOSEND_SENDER_ID }}
          AUTOSEND_SENDER_EMAIL: ${{ secrets.AUTOSEND_SENDER_EMAIL }}
          AUTOSEND_UNSUB_GROUP_ID: ${{ secrets.AUTOSEND_UNSUB_GROUP_ID }}
          NEWSLETTER_TEST_EMAIL: ${{ secrets.NEWSLETTER_TEST_EMAIL }}
          # Passed via env, not interpolated into shell source: a committed
          # filename must be data here, never code, in a secrets-bearing job.
          SLUGS: ${{ steps.added.outputs.slugs }}
        run: |
          FAILED=0
          while IFS= read -r SLUG; do
            [ -z "$SLUG" ] && continue
            echo "::group::drafting $SLUG"
            node scripts/newsletter-draft.mjs "$SLUG" || FAILED=1
            echo "::endgroup::"
          done <<< "$SLUGS"
          exit $FAILED
```

- [ ] **Step 2: Validate the workflow file**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/newsletter-draft.yml')); print('yaml ok')"`
Expected: `yaml ok`

Also sanity-check the slug extraction locally:

Run: `echo "src/content/posts/my-new-post.mdx" | sed -E 's|.*/([^/]+)\.(md\|mdx)$|\1|'`
Expected: `my-new-post`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/newsletter-draft.yml
git commit -m "Add newsletter-draft GitHub Action for new posts on main"
```

---

### Task 6: Autosend project restructure + secrets (setup, not code)

**Files:** none (dashboard/MCP/settings work). This task is executed interactively by Claude + Darshan in the session, NOT by a code subagent.

**Interfaces:**
- Consumes: nothing from the code tasks
- Produces: the six real secret values used by Task 5 (GitHub) and the two updated Vercel env values consumed by the existing `/api/subscribe` route

- [ ] **Step 1 (Darshan, dashboard):** Create Autosend project `darshanpania.me`; add domain `darshanpania.me`; publish the SPF/DKIM DNS records Autosend shows; wait for domain verification; copy the new project's API key and paste it into the session/secrets (never into the repo).

- [ ] **Step 2 (Claude, MCP):** `switch_project` to the new project, then:
  - `create_sender` — email `musings@darshanpania.me`, name `Darshan Pania`, replyTo `darshanpania@gmail.com` → record sender id
  - `create_contact_list` — name `Website Blog` → record list id
  - `create_suppression_group` — name `Newsletter` (default group for campaign unsubscribes) → record group id (use the field the campaign API accepts; verify in Task 7 that the draft shows the right group, trying `groupId` short code vs `id` if needed)
  - Migrate the 3 contacts from the FPLGuru project's `Website Blog` list (read them in the old project, upsert into the new list via `POST /v1/contacts/email` with the new project's API key)

- [ ] **Step 3 (Darshan, dashboard):** Enable double opt-in on the new `Website Blog` list (matches capture-side spec; not exposed via MCP).

- [ ] **Step 4 (Darshan, GitHub):** Repo → Settings → Secrets and variables → Actions → add: `AUTOSEND_API_KEY`, `AUTOSEND_LIST_ID`, `AUTOSEND_SENDER_ID`, `AUTOSEND_SENDER_EMAIL` (= `musings@darshanpania.me`), `AUTOSEND_UNSUB_GROUP_ID`, `NEWSLETTER_TEST_EMAIL` (= `darshanpania@gmail.com`).

- [ ] **Step 5 (Darshan, Vercel):** Project → Settings → Environment Variables → update `AUTOSEND_API_KEY` and `AUTOSEND_LIST_ID` to the new project's values (Production + Preview + Development) → redeploy so `/api/subscribe` writes to the new project.

- [ ] **Step 6 (verify):** Submit the inline form on a deployed blog post with a test address → contact appears in the NEW project's `Website Blog` list.

---

### Task 7: End-to-end verification

**Files:** none (verification only, run in the session with real env values from Task 6)

**Interfaces:**
- Consumes: everything above
- Produces: confidence + a deleted test draft

- [ ] **Step 1: Full suite green**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Real draft for an existing post**

With the six env vars exported locally (values from Task 6):

Run: `npm run build && npm run newsletter:draft -- smarter-tools-dumber-us`
Expected output ends with: `test email sent — go approve the campaign`

- [ ] **Step 3: Verify in Autosend**

- Draft campaign `blog: smarter-tools-dumber-us` exists in the `darshanpania.me` project, status draft, audience `Website Blog`, sender `musings@darshanpania.me`, unsubscribe group set (if the group looks wrong, swap the `AUTOSEND_UNSUB_GROUP_ID` value between the group's `id` and short `groupId` code and re-check)
- Test email arrived at darshanpania@gmail.com: renders correctly, images load (absolute URLs), "read on the site →" works, unsubscribe link resolves to a real URL (not literal `{{unsubscribe}}`)

- [ ] **Step 4: Verify idempotency**

Run: `npm run newsletter:draft -- smarter-tools-dumber-us`
Expected: `campaign "blog: smarter-tools-dumber-us" already exists (id ...) — nothing to do`, exit 0.

- [ ] **Step 5: Clean up**

Delete the test draft campaign (MCP `delete_campaign` or dashboard). Confirm the list still has its migrated contacts.

- [ ] **Step 6: Merge readiness**

Push the branch; open PR when Darshan asks. After merge, the first real new post exercises the workflow — watch its Actions run.
