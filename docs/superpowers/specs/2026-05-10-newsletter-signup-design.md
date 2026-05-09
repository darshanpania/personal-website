# Newsletter signup — design spec

**Date:** 2026-05-10
**Branch:** `newsletter-signup`
**Status:** Approved (pending final spec review)

## Summary

Add a newsletter signup feature to internal blog posts on darshanpania.me. Two surfaces: an always-visible inline form at the bottom of every post, and a dismissible modal that appears once the reader scrolls past 50% of the article. Both feed a dedicated AutoSend list via a single Vercel serverless function. External blog posts (which link out to Substack/ThinkDeli/etc.) are unaffected because they never load the internal post route.

## Goals

- Capture emails from engaged blog readers without being annoying
- Reuse the existing AutoSend account (no new SaaS)
- No standalone backend, no database — one serverless function on Vercel's free tier
- Per-post dismissal (a returning reader sees the modal at most once per post)
- Track funnel + attribution in PostHog (already wired into the site)

## Non-goals

- A/B testing of copy
- Referral / share-to-subscribe flow
- "Subscribed" badge across the rest of the site
- Backend-side analytics or persistence (PostHog + AutoSend cover it)
- GDPR consent banner (collecting only an email, freely given, with stated purpose; revisit if scope expands)

## Decisions (locked during brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| List provider | AutoSend (already paid) | Reuse existing tooling; no new vendor |
| List scope | New dedicated AutoSend list (`darshanpania.me blog`), separate from existing Substack | Subscribers signed up for site writing, not the fiction Substack (which may eventually be wound down into this list anyway) |
| Server | Single Vercel serverless function (`src/pages/api/subscribe.ts`) | AutoSend's bearer-token auth requires a proxy; Vercel Hobby covers this for free at our scale |
| Trigger | Inline footer form (always) + modal at 50% scroll | Multiple surfaces, but modal is dismissible and gated |
| Frequency cap | Once per post (per-slug localStorage flag) | Engaged repeat readers aren't blocked from seeing it on different posts; on the same post, dismiss = gone |
| Voice | Quirky / personal | Matches recent contact-page rewrite |
| Content promise | Cadence (~1 per new post), no spam, no list-sharing, easy unsubscribe; topic is open-ended ("whatever I'm writing") since fiction may move here later |

## Architecture

```
Browser (only on /blog/[slug] pages)
  ├── <NewsletterInline>  — always rendered at end of <article>
  └── <NewsletterModal>   — shown at 50% scroll if not previously dismissed/subscribed for this slug

  Both share one client script that:
    - reads/writes  localStorage["newsletter:<slug>"] = "dismissed" | "subscribed"
    - reads/writes  localStorage["newsletter:any"]   = "subscribed"   (global)
    - POSTs to /api/subscribe
    - emits PostHog events

/api/subscribe.ts  (Vercel serverless function via Astro per-route SSR opt-in)
  ├── validates body (email format + honeypot field empty)
  ├── light rate-limit (in-memory per-IP, 5 req / 60s)
  ├── reads AUTOSEND_API_KEY + AUTOSEND_LIST_ID from env
  ├── POSTs https://api.autosend.com/v1/contacts/email with bearer auth
  └── returns 200 / 400 / 429 / 502 with a small JSON envelope

AutoSend
  └── handles double opt-in (enable in dashboard), unsubscribe, broadcast campaigns
```

**Two boundary decisions worth calling out:**

1. **Internal-only is automatic.** External posts in `src/content/blog.json` link out and never render `/blog/[slug]`. The newsletter components live exclusively inside `src/pages/blog/[...slug].astro`, so no URL-gating logic is needed.
2. **Global "subscribed" flag short-circuits both surfaces.** Once a reader subscribes anywhere, neither modal nor inline form appears again on any post — the inline form swaps to a static "you're subscribed ✓" card.

## Components & UX

### `src/components/NewsletterInline.astro`

Rendered at the article footer, between the share row and the closing `</article>`. Always visible (unless globally subscribed, in which case it renders the success card).

Layout sketch:
```
┌───────────────────────────────────────────────────────────┐
│  get the next one in your inbox                          │
│  i write whenever i write — engineering, sci-fi, the     │
│  occasional rant. ~1 email per new post. no spam, no     │
│  list-sharing, unsubscribe in one click.                 │
│                                                           │
│  [ you@example.com              ] [ subscribe ]          │
└───────────────────────────────────────────────────────────┘
```

States:
- `idle` — form input + submit button
- `loading` — submit button disabled, spinner or "subscribing…" label
- `success` — card swaps to "you're in. check your inbox to confirm."
- `error` — message under input, form remains editable

On mount: if `localStorage["newsletter:any"] === "subscribed"`, render `success` directly.

### `src/components/NewsletterModal.astro`

Fixed centered overlay, dimmed backdrop, dismissible.

Layout sketch:
```
                         ┌───────────────────── ✕ ┐
                         │                         │
                         │  enjoying this?         │
                         │                         │
                         │  let me send the next   │
                         │  one to your inbox.     │
                         │  ~1 per new post,       │
                         │  unsubscribe anytime,   │
                         │  pinky promise no spam. │
                         │                         │
                         │  [ email          ]     │
                         │  [    subscribe    ]    │
                         │                         │
                         │  no thanks              │
                         └─────────────────────────┘
                          (dimmed page behind)
```

Accessibility:
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` referencing the heading
- Focus trapped inside the modal while open; focus returns to the article on close
- ESC key closes (counts as dismiss)
- Backdrop click closes (counts as dismiss)
- Hidden `<label for="newsletter-modal-email">` on the email input
- Error messages announced via `aria-live="polite"`
- Honeypot field is `aria-hidden="true"` + `tabindex="-1"` + `display:none`

Visual style follows the existing design system (CSS custom properties: `--text-primary`, `--text-secondary`, `--surface`, `--border`, `--mono-accent`). Inline form uses `--surface` background with `--border` outline; modal uses the same surface with a slightly stronger shadow and a backdrop of `rgba(0,0,0,0.5)`.

### Trigger logic

Single inline `<script>` at the bottom of `src/pages/blog/[...slug].astro`, with `slug` injected via `define:vars`:

```js
on DOMContentLoaded:
  if localStorage["newsletter:any"] === "subscribed": return
  if localStorage["newsletter:" + slug] in ("dismissed", "subscribed"): return
  if document.body.scrollHeight < 1.5 * window.innerHeight: return   // skip on tiny posts
  attach throttled scroll listener (~150ms):
    scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight
    if scrolled >= 0.5:
      open modal, detach listener, fire newsletter_modal_shown
```

### Interaction outcomes

| Event | Effect |
|---|---|
| Submit succeeds (anywhere) | Set `newsletter:any = subscribed` AND `newsletter:<slug> = subscribed`. Both surfaces switch to success state. |
| Submit fails (anywhere) | Show error inline; no localStorage write; user can retry. |
| Modal dismissed (✕ / ESC / backdrop / "no thanks") | Set `newsletter:<slug> = dismissed`. Inline form still renders. |
| Visit a different post | Clean slate — modal can show again unless globally subscribed. |

## Data flow & `/api/subscribe.ts`

### Request

```http
POST /api/subscribe
Content-Type: application/json

{
  "email":   "reader@example.com",
  "source":  "modal" | "inline",
  "slug":    "smarter-tools-dumber-us",
  "website": ""
}
```

`source` and `slug` are for analytics (PostHog event enrichment via response handler). `website` is the honeypot.

### Response envelopes

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ "ok": true }` | Subscribed (or already subscribed — AutoSend upsert is idempotent) |
| 400 | `{ "ok": false, "error": "invalid_email" }` | Email failed validation, or AutoSend rejected with 4xx |
| 400 | `{ "ok": false, "error": "honeypot" }` | Bot detected — UI pretends success |
| 429 | `{ "ok": false, "error": "rate_limited" }` | More than 5 attempts in 60s from this IP |
| 502 | `{ "ok": false, "error": "upstream" }` | AutoSend 5xx, network error, or timeout |

### Function logic

```ts
// src/pages/api/subscribe.ts
export const prerender = false;

export async function POST({ request, clientAddress }) {
  // 1. Parse JSON body. On parse failure → 400 invalid_email.
  // 2. Validate email with strict regex (RFC-5322-lite). On fail → 400 invalid_email.
  // 3. If body.website is non-empty → 400 honeypot.
  // 4. Rate-limit check via in-memory Map<ip, { count, windowStart }>:
  //    >5 requests in 60s from same IP → 429 rate_limited.
  //    (Best-effort — resets on cold start, acceptable for a personal blog.)
  // 5. POST to https://api.autosend.com/v1/contacts/email
  //    headers: Authorization: Bearer ${AUTOSEND_API_KEY}, Content-Type: application/json
  //    body:    { email, listIds: [AUTOSEND_LIST_ID] }
  //    timeout: 8s via AbortController.
  // 6. Map AutoSend response:
  //    2xx          → 200 ok
  //    4xx          → log status only, return 400 invalid_email (don't leak upstream details)
  //    5xx / throw  → 502 upstream
}
```

### Astro adapter switch

The site is currently fully static (Astro 5, no adapter). To add a server route while keeping every other page static:

1. `npm install @astrojs/vercel`
2. Update `astro.config.mjs`:
   ```js
   import vercel from "@astrojs/vercel";
   export default defineConfig({
     // ...existing config
     adapter: vercel(),
     // output stays at the Astro 5 default ("static")
   });
   ```
3. Astro 5 defaults `output` to `"static"` and renders pages on-demand only when a route opts in via `export const prerender = false`. So all existing pages stay statically pre-rendered with no per-page change. Only `src/pages/api/subscribe.ts` opts in to SSR.

Net result: zero deployment-shape change for existing pages, one new function endpoint.

### Environment variables (Vercel project settings — Production + Preview + Development)

- `AUTOSEND_API_KEY` — bearer token from AutoSend dashboard
- `AUTOSEND_LIST_ID` — ID of the new list created in AutoSend (see Setup steps)

### Why no subscriber storage on our side

AutoSend is the source of truth. The localStorage flag is a UX optimization, not auth. If a reader clears storage and resubscribes, AutoSend's upsert is idempotent — no duplicate contact, no broken state.

## Error handling (client side)

| Server response | UI behavior |
|---|---|
| 200 ok | Swap form to success card. Persist `newsletter:any` + `newsletter:<slug>` = `subscribed`. Fire `newsletter_signup_success`. |
| 400 invalid_email | Inline message: "that email looks off — mind double-checking?" Form stays editable. No localStorage write. Fire `newsletter_signup_failed` with `reason: invalid_email`. |
| 400 honeypot | UI pretends success (don't tip off bots). No localStorage write, no PostHog success event. Real users never trigger this. |
| 429 rate_limited | Message: "too many tries — give it a minute and try again." No localStorage write. |
| 502 upstream | Message: "something broke on my end. try again in a bit?" No localStorage write. Fire `newsletter_signup_failed` with `reason: upstream`. |
| Timeout (>10s no response) | Same as 502. Client-side AbortController at 10s. |

Submit button is disabled while a request is in flight to prevent double-submits.

## Security

- **Honeypot field** (`name="website"`, hidden) — kills naïve bots.
- **Rate limit** — in-memory per-IP, 5 req / 60s. Best-effort, defense-in-depth.
- **No CSRF token** — endpoint is idempotent (AutoSend upsert) and accepts only an email. Worst-case cross-site abuse is subscribing a stranger to your newsletter; AutoSend's double opt-in (enable in their dashboard) neutralizes this.
- **CORS** — endpoint is same-origin only by default in Vercel; we do not add `Access-Control-Allow-Origin`.
- **No PII in logs** — function logs HTTP status codes and error categories, never email addresses or AutoSend response bodies containing PII.
- **API key safety** — `AUTOSEND_API_KEY` lives only in Vercel env vars. Never in the repo, never in client bundles. The whole reason the proxy exists.

## Observability (PostHog)

PostHog is already wired in `src/layouts/Base.astro` via `window.posthog`. Add the following events:

| Event | Properties | When fired |
|---|---|---|
| `newsletter_modal_shown` | `slug`, `category` | Modal opens after 50% scroll trigger |
| `newsletter_modal_dismissed` | `slug`, `dismiss_method` (`close_btn` / `backdrop` / `esc` / `no_thanks`) | Any dismiss path |
| `newsletter_signup_attempt` | `slug`, `source` (`modal` / `inline`) | Submit button clicked |
| `newsletter_signup_success` | `slug`, `source` | 200 from `/api/subscribe` |
| `newsletter_signup_failed` | `slug`, `source`, `reason` | Non-2xx (`invalid_email` / `rate_limited` / `upstream`) |

Enables in PostHog:
- Modal-shown → dismissed funnel
- Source attribution: does the inline footer or the modal convert better?
- Per-post signup rates

## Testing strategy

Pragmatic, no TDD:

- **Manual smoke checklist** (in the implementation plan): load post → scroll past 50% → modal appears → fire event in PostHog → submit valid email → success card → reload → modal does not reappear → check AutoSend dashboard for the contact.
- **One unit test file for `/api/subscribe.ts`** at `tests/api/subscribe.test.ts` using Vitest: mock `fetch`, assert all five response branches (valid, invalid email, honeypot, rate-limited, AutoSend 5xx).
- **Lighthouse + axe-core check** on a blog post with the modal open: no a11y regressions, no CLS introduced by the inline form.

## Setup steps (one-time, manual, before deploy)

1. Log into AutoSend → Lists → create list named `darshanpania.me blog` → copy the list ID.
2. AutoSend → Settings → API keys → create or copy a bearer token.
3. AutoSend → list settings → enable double opt-in (so the confirmation email goes out automatically).
4. Vercel → project → Settings → Environment Variables → add `AUTOSEND_API_KEY` and `AUTOSEND_LIST_ID` to Production, Preview, and Development scopes.
5. Locally: add the same two vars to `.env` (gitignored) for `astro dev` testing.

## File-level changes summary

- `astro.config.mjs` — add Vercel adapter, set `output: "hybrid"`
- `package.json` — add `@astrojs/vercel`, add `vitest` (dev)
- `src/pages/api/subscribe.ts` — new serverless route
- `tests/api/subscribe.test.ts` — Vitest unit tests (kept outside `src/pages/` so Astro doesn't pick it up as a route)
- `vitest.config.ts` — minimal Vitest config pointing at `tests/`
- `src/components/NewsletterInline.astro` — new inline form component
- `src/components/NewsletterModal.astro` — new modal component
- `src/pages/blog/[...slug].astro` — render `NewsletterInline` at footer; render `NewsletterModal`; inject scroll-trigger script
- `.env.example` — document `AUTOSEND_API_KEY` and `AUTOSEND_LIST_ID`
- `.gitignore` — confirm `.env` is ignored (already is)

## Open questions

None at spec time. All decisions locked during brainstorm.
