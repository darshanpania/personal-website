# darshanpania.me

A typography-first personal site for [Darshan Pania](https://darshanpania.me). Single column, content-first, minimal chrome. Warm paper background in light mode, cold precise dark in dark mode, with a sage-green / blue mono accent that gives the site its visual personality.

## Tech stack

- **[Astro 5](https://astro.build)** with static output
- **[Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)** via `@tailwindcss/vite`, configured through CSS `@theme` and a small set of root CSS variables
- **[MDX](https://mdxjs.com)** for local long-form posts
- **Geist Sans + Geist Mono** via `@fontsource`
- **[three.js](https://threejs.org)** for the 3D world, loaded on demand (see "3D world" below)
- **TypeScript** end-to-end
- **[Kalos](https://github.com/dk-marketplace/kalos)** governs the design tokens declared in `.kalos.yaml`
- Deployed on **Vercel**

## Getting started

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # preview the built site
```

## Project layout

```text
src/
  layouts/Base.astro          shared HTML shell, sticky header, fade-in observer, no-flash theme script
  components/                 Header, ThemeToggle, TypingName (animated headings), SocialIcon (inline brand SVGs), PostRow
  pages/
    index.astro               home — typing name, bio, social row, recent writing
    blog/
      index.astro             year-grouped list with client-side category filter (tech / fiction / non-fiction)
      [...slug].astro         renders local MDX posts
    projects.astro            list view from src/content/projects.json
    resume.astro              experience, education, awards, speaking
    contact.astro             email + cal.com under "reach me", socials under "elsewhere"
  content/
    blog.json                 link-out entries for posts published on Substack, Medium, etc.
    posts/*.mdx               local MDX posts rendered at /blog/<slug>
    projects.json             projects shown on /projects
  content.config.ts           Astro content collection schemas (Zod)
  world/                      the 3D layer (three.js) — see "3D world" below
  styles/global.css           Tailwind import, light/dark CSS variables, prose styles, keyframes
scripts/blender/              Python scripts that build the 3D models with Blender (`npm run models`)
public/models/                the built models (.glb)
docs/superpowers/specs/       design spec for the redesign
.kalos.yaml                   design token + brand palette config (light + dark)
```

## Writing a new post

There are two paths.

### Linking out to a post that lives elsewhere

Add an entry to `src/content/blog.json`:

```json
{
  "id": "my-post-slug",
  "title": "My Post",
  "date": "2026-05-15",
  "category": "fiction",
  "platform": "Substack",
  "url": "https://lostmeanderingthoughts.substack.com/p/my-post",
  "description": "Optional one-liner used for metadata."
}
```

`category` must be exactly `tech`, `fiction`, or `non-fiction`. The entry shows up on `/blog` (sorted by date, year-grouped, filterable) with a `↗` next to the title; if it's in the latest three, it also shows in the home page's "recent writing".

### Posting locally on darshanpania.me

Create a file in `src/content/posts/`:

```mdx
---
title: "My Post"
date: 2026-05-15
category: tech
description: "Used for metadata + social cards."
draft: false
---

Markdown / MDX body goes here. Code blocks, headings, links, lists all pick up
the prose styles in `src/pages/blog/[...slug].astro`.
```

The filename becomes the URL slug — `my-post.mdx` renders at `/blog/my-post`. `draft: true` keeps a post out of the listings while you work on it.

`npm run build` validates every entry against the Zod schemas in `content.config.ts`, so a malformed date or unknown category fails the build rather than shipping silently.

## Newsletter signup (double opt-in)

Nobody receives a campaign until they click a link in their inbox. Two
AutoSend lists enforce it:

| List | Env var | Role |
|---|---|---|
| Website Blog — Pending Confirmation | `AUTOSEND_PENDING_LIST_ID` | Where every signup lands. Never targeted by a campaign. |
| Website Blog | `AUTOSEND_LIST_ID` | Confirmed subscribers. The only list campaigns send to. |

The flow:

1. `POST /api/subscribe` validates the address, adds it to the **pending**
   list, and emails a confirmation link.
2. The link carries a token — base64url JSON (`email` + expiry) signed with
   HMAC-SHA256 under `NEWSLETTER_CONFIRM_SECRET`. Nothing is stored
   server-side; the signature is what makes the link unforgeable, so a
   stranger can't confirm someone else's address by guessing an id. Valid for
   48 hours.
3. `GET /confirm?token=…` verifies the signature and expiry and renders a
   button. It does **not** subscribe anyone — mail scanners and link
   prefetchers issue GETs, so confirming there would let a security appliance
   opt someone in on their behalf, which is the exact consent this feature
   exists to obtain.
4. The button `POST`s JSON to `/api/confirm`, which re-verifies the token (the
   route is reachable directly), adds the contact to the **confirmed** list,
   removes them from the pending list, and returns `{ state }`. The page then
   sends the reader to `/subscribed?state=…`.

The body is JSON, not a form encoding, and that is load-bearing. Astro's
`security.checkOrigin` is on by default and rejects cross-origin POSTs whose
content type is form-like, comparing the `Origin` header against the origin it
derives from the request. Behind the Cloudflare → Vercel proxy those never
agree, so a plain `<form>` submission 403s for every real visitor. JSON is not
a form-like type, so it passes — the same reason `/api/subscribe` has always
worked.

The pending-list removal is best-effort: once the confirmed membership lands
the reader is subscribed, and failing them over a leftover row on a list
nothing sends to would be the wrong call. `removeFromList` refuses to act on
`GLOBAL_CONTACT_LIST`, where a removal deletes the contact outright instead of
dropping one membership.

Because `scripts/newsletter-draft.mjs` targets `AUTOSEND_LIST_ID`, an
unconfirmed address is unreachable by construction — there's no rule to
remember and no way to accidentally mail the pending list.

Rotating `NEWSLETTER_CONFIRM_SECRET` invalidates every unclicked link still in
flight. Those readers just sign up again.

`/subscribed` renders four states — `confirmed`, `expired`, `invalid`,
`error` — and anything unrecognised falls back to `invalid`.

## 3D world (in progress)

The site is being re-imagined in 3D. The typographic site stays as it is: every URL still renders real HTML, and that HTML is what a visitor sees first. The 3D world is an extra layer on top.

- **One canvas for the whole site.** `src/components/World.astro` puts a fixed `<canvas id="world">` behind the page. `transition:persist` keeps the same canvas (and its WebGL context) alive through view transitions, so a page change is a camera move, not a reload.
- **Text first.** `src/world/boot.ts` is tiny and ships with every page. It loads three.js and the scene (`src/world/engine.ts`, `src/world/themes/*`) only when the visitor gets the 3D world, and only after the browser is idle.
- **Lite mode.** `decideMode` in `src/world/mode.ts` picks between `3d` and `lite` (the typographic site alone). No WebGL2 means lite. Reduced motion, data saver, or a low-memory device default to lite. The `3d: on / off` switch in the footer saves the visitor's choice in `localStorage.world`, and a saved choice wins over the defaults.
- **Stops.** `stopFor` in `src/world/stops.ts` maps each URL to a place in the world (`home`, `blog`, `post`, `projects`, `resume`, `contact`, `other`).
- **Themes.** A theme owns the scene and the camera (`WorldTheme` in `src/world/theme.ts`). The engine owns the renderer, the frame loop (it draws on demand and stops when nothing moves), and the bridge to the site: routes, dark mode, resize, scroll, pointer. `themes/placeholder.ts` is a test scene; the real theme replaces it.

- **Models.** Blender makes the models from Python, with no hand-made `.blend` files. Each model is a module in `scripts/blender/models/` with a `build()` function. `npm run models` runs Blender headless and writes `public/models/<name>.glb` (meshopt-compressed); `loadModel(name)` in `src/world/assets.ts` loads one. The `.glb` files are committed, so the Vercel build does not need Blender. A material name is a contract: a theme finds a material by name to tint it with a site token (the test model has `paper` and `accent`).

`html.world-on` is set once the first frame is on the canvas. Styles that only apply over the 3D world hang off that class.

## Design tokens

`src/styles/global.css` declares the canonical CSS variables for both modes:

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#faf8f5` | `#131516` |
| `--surface` | `#f0ede8` | `#1c1f21` |
| `--border` | `#ddd8d0` | `#2c3035` |
| `--text-primary` | `#18130e` | `#e4e6e8` |
| `--text-secondary` | `#7c736a` | `#7a8390` |
| `--mono-accent` | `#3d5a80` | `#7eb8a4` |

Every link, accent, and brand mark uses `text-(--mono-accent)`, which switches automatically when the `.dark` class is applied to `<html>` (set by the no-flash inline script in `Base.astro` based on `localStorage` or system preference).

The same tokens are mirrored in `.kalos.yaml` so Kalos can validate design artifacts (e.g. Pencil mockups) against the same constraints.

## Conventions

- **Content width:** 640px max, centered.
- **Page headings** use the `TypingName` component for the typing animation + cursor blink.
- **External links** add `target="_blank"`, `rel="noopener noreferrer"`, and visually trail with `↗`.
- **Internal links** within the site stay un-decorated unless they're in prose.
- **Geist Mono** is reserved for the brand mark, page titles, dates, tags, social labels, and code — body and post copy are Geist Sans.

## Deploy

`vercel.com` autodetects Astro from `astro.config.mjs` and `package.json`. No special build command needed.
