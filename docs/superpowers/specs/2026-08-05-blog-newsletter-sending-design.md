# Blog → newsletter sending via Autosend — design spec

**Date:** 2026-08-05
**Branch:** `claude/website-autosend-newsletter-2tm33v`
**Status:** Approved (pending final spec review)

## Summary

Complete the newsletter loop on darshanpania.me. The capture side already exists
(inline form + scroll modal → `/api/subscribe` → Autosend list, built May 2026).
This spec adds the sending side: when a new internal blog post merges to `main`,
a GitHub Action renders it as email HTML, creates a **draft** campaign in
Autosend addressed to the blog list, and sends a test email to
darshanpania@gmail.com. Nothing goes to subscribers until Darshan explicitly
sends the campaign (dashboard button or Claude/MCP). Alongside the code, the
Autosend account is restructured: a dedicated `darshanpania.me` project
(now possible on the multi-project plan) replaces the current arrangement where
the blog list lives inside the FPLGuru project.

## Goals

- Every new internal post becomes a ready-to-approve newsletter draft with zero
  manual formatting
- Full post readable in the inbox (Substack-style), with a "read on the site" link
- Human approval gate before anything reaches subscribers
- Email HTML always matches the site's rendering of the post (single MDX pipeline)
- Clean separation of personal-blog audience/sender/stats from FPLGuru

## Non-goals

- Emails for external posts (Substack fiction, ThinkDeli, …) — Substack already
  emails its own audience; external entries in `blog.json` stay links-only
- Fully automatic sending (explicitly rejected: a typo'd or accidental merge
  must never email the list)
- Re-sending on post edits (idempotency by slug; edits never re-draft)
- Digest/batching of multiple posts into one email (each post = one campaign)
- Custom campaign scheduling, A/B subjects, per-subscriber personalization

## Decisions (locked during brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Autosend structure | New dedicated project `darshanpania.me`; migrate the 3 `Website Blog` list contacts out of the FPLGuru project | Multi-project plan now allows it; keeps audiences, suppressions, senders, and analytics separate |
| Sender | `musings@darshanpania.me`, reply-to `darshanpania@gmail.com` | Personal, on-brand for the site's voice; replies land somewhere readable |
| Automation level | Auto-draft on publish, human approves the send | Zero-effort drafting without accidental-send risk |
| Email content | Full post in the email, "read on the site →" link on top | Text-heavy posts read well in the inbox; best reader experience |
| Trigger scope | Only added files in `src/content/posts/` (internal MDX posts) | External posts are announced by their own platforms |
| Pipeline | GitHub Action on push to `main` | Deterministic trigger, code-reviewed in-repo, CI logs, no new infra |
| Rendering | Build-time route reusing Astro's MDX pipeline | Email content can never drift from site content |
| Idempotency | Campaign named `blog: <slug>`; skip if a campaign with that name exists | Safe re-runs, safe post edits, safe force-pushes |

## Architecture

```
merge new post (src/content/posts/<slug>.mdx) to main
  ├── Vercel deploys the site                     (existing, unchanged)
  └── GitHub Action .github/workflows/newsletter-draft.yml
        1. git diff detects ADDED files under src/content/posts/
           (skips run entirely when none — path filter on the trigger)
        2. npm ci && npm run build
           → dist/ now contains /newsletter/<slug>/ email HTML (new route)
        3. for each added slug:
           node scripts/newsletter-draft.mjs <slug>
             ├── query Autosend campaigns for name "blog: <slug>"
             │     exists → reuse draft (idempotent; test email still sent)
             ├── read dist/newsletter/<slug>/index.html
             ├── transform: absolutize URLs, inline CSS, strip scripts/embeds
             ├── create DRAFT campaign
             │     name     "blog: <slug>"
             │     subject  post title
             │     preheader post description
             │     from     musings@darshanpania.me
             │     audience Website Blog list
             └── send test email → darshanpania@gmail.com

Darshan reads the test email
  └── approves → Send in Autosend dashboard, or tells Claude (MCP send_campaign)
```

The subscribe path (`/api/subscribe`) is untouched code-wise; its env vars are
repointed at the new project (see Config).

## Components

### 1. `src/pages/newsletter/[...slug].astro` — email rendering route (new)

Prerendered static route, one page per non-draft internal post, built by
`getStaticPaths` over the `posts` collection exactly like `blog/[...slug].astro`.
Output is a complete standalone HTML document shaped for email clients, not a
site page:

- No site layout, no site CSS, no JS. A small dedicated `<style>` block only.
- Single column, `max-width: 600px`, hardcoded light-theme colors (email
  clients handle dark-mode CSS badly), system font stack.
- Structure: header (`musings — darshanpania.me`), post title, date,
  "read on the site →" link (absolute URL to `/blog/<slug>`), cover image,
  full rendered post body, footer ("you're getting this because you subscribed
  at darshanpania.me" + unsubscribe link via Autosend's unsubscribe merge tag —
  exact tag syntax confirmed against Autosend docs as an implementation step).
- Post description rendered as hidden preheader text at the top of the body.

Kept out of discovery:

- `<meta name="robots" content="noindex">` on the route
- Sitemap integration gets a `filter` excluding `/newsletter/`
- `robots.txt` gains `Disallow: /newsletter/`
- RSS already only includes blog posts; no change needed there

### 2. `scripts/newsletter-draft.mjs` — transform + draft script (new)

Node script run by CI; also runnable locally. Split so the pure transform is
unit-testable:

- `scripts/lib/email-transform.mjs` — pure function `(html, siteUrl) → html`:
  - absolutize every `href`/`src` (cheerio, not regex)
  - inline the `<style>` block into `style=""` attributes (juice)
  - strip `<script>`; replace iframes/embeds with a "view this on the site" link
- `scripts/lib/autosend.mjs` — thin REST client for the campaign endpoints
  (list/search campaigns, create campaign, send test email), bearer-auth with
  `AUTOSEND_API_KEY`, 15s timeouts, no PII in logs. Exact endpoint paths are
  confirmed from Autosend's API docs during implementation (the MCP tools prove
  drafts, test-sends, and name-filtered listing all exist in the product).
- `scripts/newsletter-draft.mjs` — orchestrates: read post frontmatter for
  title/description (gray-matter or a tiny parser), read built HTML, transform,
  idempotency check, create draft, send test.
- `--dry-run` flag: writes the final email HTML to
  `scripts/out/<slug>.email.html` and prints the would-be campaign payload
  instead of calling Autosend. Used for local eyeballing and CI debugging.

Failure = non-zero exit = red workflow run = GitHub notification email. Safe to
re-run from the Actions UI thanks to the idempotency check.

### 3. `.github/workflows/newsletter-draft.yml` — the trigger (new)

- `on: push: branches: [main], paths: ["src/content/posts/**"]`
- Detect **added** `.mdx` files via `git diff --diff-filter=A --name-only`
  between `github.event.before` and `github.event.after` (with
  `fetch-depth: 0`; falls back to the push's commit range). Modified files are
  ignored — edits never draft.
- Draft posts (`draft: true` frontmatter) are excluded by the build itself
  (no `/newsletter/` page is emitted), and the script double-checks frontmatter
  and skips them.
- Secrets: `AUTOSEND_API_KEY`, `AUTOSEND_LIST_ID`, `AUTOSEND_SENDER_ID`,
  `AUTOSEND_SENDER_EMAIL`, `AUTOSEND_UNSUB_GROUP_ID`, `NEWSLETTER_TEST_EMAIL`
  (repository secrets, new-project values).
- Multiple posts in one push → loop, one campaign per slug; one slug failing
  doesn't stop the others (failures collected, workflow fails at the end).

### 4. Autosend account restructure (one-time, mostly manual)

1. **Darshan, dashboard:** create project `darshanpania.me`; add domain
   `darshanpania.me` and publish the SPF/DKIM DNS records Autosend provides;
   copy the new project's API key.
2. **Claude, MCP/API:** in the new project — create sender
   `musings@darshanpania.me` (reply-to `darshanpania@gmail.com`); create list
   `Website Blog`; enable double opt-in on it (matching the capture-side spec);
   migrate the 3 contacts from the FPLGuru project's `Website Blog` list.
3. FPLGuru project keeps its old list as-is (or Darshan deletes it later);
   nothing else there changes.

## Config changes

| Where | Key | Change |
|---|---|---|
| Vercel env (Prod/Preview/Dev) | `AUTOSEND_API_KEY` | new project's key |
| Vercel env | `AUTOSEND_LIST_ID` | new project's `Website Blog` list id |
| GitHub repo secrets | `AUTOSEND_API_KEY`, `AUTOSEND_LIST_ID`, `AUTOSEND_SENDER_ID`, `AUTOSEND_SENDER_EMAIL`, `AUTOSEND_UNSUB_GROUP_ID`, `NEWSLETTER_TEST_EMAIL` | new |
| `.env.example` | same four newsletter keys | documented |
| `astro.config.mjs` | sitemap `filter` | exclude `/newsletter/` |
| `public/robots.txt` | `Disallow: /newsletter/` | new line |
| `package.json` | `cheerio`, `juice`, `gray-matter` (dev deps); `newsletter:draft` script | new |

## Error handling

| Failure | Behavior |
|---|---|
| Autosend API down / 5xx | Script exits non-zero → red run → GitHub notifies; re-run from Actions UI is safe (idempotent) |
| Campaign already exists for slug | Log + reuse the existing draft; test email still sent (expected on re-runs) |
| Built HTML missing for slug (e.g. draft post) | Log + skip that slug, exit 0 |
| Transform produces empty body | Exit non-zero before any Autosend call |
| Test-email send fails after campaign created | Non-zero exit with clear message; draft still exists in dashboard (harmless — nothing sent to the list) |
| Push edits (not adds) post files | Workflow runs, diff finds no added files, exits 0 quickly |

## Security

- API key lives only in GitHub repo secrets + Vercel env; never in the repo or
  client bundles (unchanged principle from the capture-side spec).
- The workflow has no need for repo write permissions: `permissions: contents: read`.
- No PII in CI logs — the script logs slugs, campaign ids, and status codes only.
- `/newsletter/` pages contain only already-public post content; noindex +
  robots + sitemap exclusion keep them out of search.
- The draft-then-approve gate is itself the main safety control: a compromised
  or buggy run can at worst create a draft and a test email to Darshan.

## Testing

- **Vitest unit tests** (`tests/newsletter/email-transform.test.ts`) on the pure
  transform with an HTML fixture: URL absolutization (href/src, hash links
  untouched), style inlining, script stripping, embed replacement, preheader
  retention.
- **Idempotency naming test** for the `blog: <slug>` convention helper.
- **Dry-run check**: `node scripts/newsletter-draft.mjs <slug> --dry-run`
  against the real build of an existing post; eyeball the output HTML in a
  browser and an email client.
- **End-to-end before merge**: run the script for real against the new Autosend
  project with an existing post → confirm draft campaign appears, test email
  arrives at darshanpania@gmail.com, unsubscribe link renders → delete the
  draft.
- **Manual smoke after first real post**: workflow green → draft in dashboard →
  test email → send → email arrives for a subscribed test address.

## File-level changes summary

- `src/pages/newsletter/[...slug].astro` — new email-rendering route
- `scripts/newsletter-draft.mjs`, `scripts/lib/email-transform.mjs`,
  `scripts/lib/autosend.mjs` — new draft pipeline
- `.github/workflows/newsletter-draft.yml` — new trigger workflow
- `tests/newsletter/email-transform.test.ts` — new unit tests
- `astro.config.mjs` — sitemap filter
- `public/robots.txt` — disallow `/newsletter/`
- `package.json` / `package-lock.json` — dev deps + script
- `.env.example` — document new vars

## Verification steps during implementation (not open questions)

- Confirm exact Autosend REST endpoints/payloads for: create draft campaign,
  list campaigns filtered by name, send test email (MCP tool surface confirms
  the capabilities exist; docs give the REST shapes).
- Confirm Autosend's unsubscribe merge-tag syntax for custom-HTML campaigns.
- Confirm whether campaign creation needs a sender **id** or accepts a from
  address; secret `AUTOSEND_SENDER_ID` assumes id and is dropped if not needed.
