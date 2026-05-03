# Personal Website Redesign — Design Spec
Date: 2026-05-02

## Overview

Full redesign of darshanpania.me from Next.js to Astro. The goal is a minimal, typography-first personal site with a strong engineer aesthetic — crisp IDE fonts, warm/cool color contrast, typing animation on the landing page, and first-class blog support.

Reference aesthetic: leerob.com, paco.me, overreacted.io — single column, content-first, no decorative chrome.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Astro (static output) |
| Styling | Tailwind CSS v4 |
| Blog | MDX (`.mdx` files in `src/content/blog/`) |
| Fonts | Geist + Geist Mono (via `@fontsource`) |
| Deployment | Vercel (existing) |
| Design tokens | Kalos → `kalos-tokens.css` + `kalos.tailwind.config.ts` |

---

## Typography

- **Body:** Geist (sans) — all prose, nav links, UI labels
- **Accent/Mono:** Geist Mono — name on landing (with typing animation), section labels, dates, tags, social links, code in blog posts

**Type scale (1.25 ratio, 16px base):**
```
xs:   12px  — meta, timestamps
sm:   14px  — secondary text, tags
base: 16px  — body
lg:   20px  — sub-headings
xl:   25px  — page titles
2xl:  36px  — landing name (Geist Mono)
```

---

## Color Tokens

### Light Mode (warm paper base)
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#faf8f5` | Page background |
| `--surface` | `#f0ede8` | Cards, subtle containers |
| `--border` | `#ddd8d0` | Dividers, input borders |
| `--text-primary` | `#18130e` | Body text, headings |
| `--text-secondary` | `#7c736a` | Dates, labels, secondary prose |
| `--mono-accent` | `#3d5a80` | All Geist Mono elements, links |

### Dark Mode (cold precise)
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#131516` | Page background |
| `--surface` | `#1c1f21` | Cards, subtle containers |
| `--border` | `#2c3035` | Dividers, input borders |
| `--text-primary` | `#e4e6e8` | Body text, headings |
| `--text-secondary` | `#7a8390` | Dates, labels, secondary prose |
| `--mono-accent` | `#7eb8a4` | All Geist Mono elements, links |

**Design principle:** Body is warm in light mode, cold in dark mode. Geist Mono elements always render in `mono-accent` — creating a warm/cool tension that is the site's visual personality.

---

## Layout

- **Content width:** 640px max, centered
- **Single column** — no sidebar, no grid
- **Generous vertical spacing** — sections breathe

### Header (sticky)
```
darshan pania          blog  projects  resume  contact  ☀/🌙
└── Geist Mono         └── Geist, text-secondary       └── toggle
    mono-accent
```
- Thin `border` bottom
- Transparent bg that gains a subtle backdrop-blur on scroll

---

## Pages

### `/` — Home
- **Name** in Geist Mono 36px with typing animation (`Darshan Pania_`)
- **Title** (`Director of Engineering`) in Geist, `mono-accent` color
- Short horizontal rule (40px, `border` color)
- **Bio** — 2 short paragraphs, Geist 16px, 1.7 line-height
  - Paragraph 1: what you do professionally (CleverTap, SDKs, teams)
  - Paragraph 2: what you write about
- **Social links** — `github ↗  linkedin ↗  twitter ↗` in Geist Mono, `mono-accent`
- **Recent writing** — section label in Geist Mono caps, then 3 latest post rows
  - Each row: post title (Geist) + date (Geist Mono, `text-secondary`) — space-between
  - `all posts →` link at bottom in Geist Mono

### `/blog` — Blog list
- Page title: `writing` in Geist Mono, xl
- **Category filter pills** below the title: `all` · `tech` · `fiction` · `non-fiction`
  - Active pill: `text-primary` fill, `bg` text (inverted)
  - Inactive pills: no fill, `text-secondary` text
  - Filter is client-side (Astro island), no page reload
- Chronological list grouped by year, filtered by active category
- Year header in Geist Mono, sm, `text-secondary`
- Each post: title (Geist, base) + date (Geist Mono, sm, `text-secondary`) — space-between
- Thin `border` divider between posts
- Each post has a `category` frontmatter field: `tech` | `fiction` | `non-fiction`

### `/blog/[slug]` — Post
- Back link: `← writing` in Geist Mono, sm, `mono-accent`
- Title: Geist, xl, `text-primary`
- Date + read time: Geist Mono, sm, `text-secondary`
- Prose: Geist 16px, 1.75 line-height, max-width 640px
- Code blocks: Geist Mono, surface bg, border radius 6px

### `/projects` — Projects
- Page title: `projects` in Geist Mono, xl
- Simple list (not cards) — each project:
  - Name (Geist, base, `text-primary`)
  - Platform tag (Geist Mono, xs, `text-secondary`) — `android` / `ios` / `web`
  - One-line description (Geist, sm, `text-secondary`)
  - Link: `view ↗` in Geist Mono, `mono-accent`
- Thin `border` divider between projects

### `/resume` — Resume (full text)
- Page title: `resume` in Geist Mono, xl
- Sections: Experience, Education, Awards
- Section headers: Geist Mono, sm caps, `text-secondary`, with `border` bottom
- Job entries:
  - Company + role: Geist, base, `text-primary`
  - Dates: Geist Mono, sm, `text-secondary`
  - Description: Geist, sm, `text-secondary`, 1.6 line-height
- Print-friendly (no bg colors in print media query)

### `/contact` — Contact
- Page title: `contact` in Geist Mono, xl
- One short line of body text: "The best way to reach me is email."
- Links list — each on its own line in Geist Mono, `mono-accent`, with `↗`:
  - `darshanpania@gmail.com ↗`
  - `twitter / @i_m_Pania ↗`
  - `linkedin / darshanpania ↗`
  - `github / darshanpania ↗`
- No contact form

---

## Animations

- **Typing animation** (home page name only): types out "Darshan Pania" character by character with blinking `|` cursor. Runs once on load. ~800ms total. CSS + vanilla JS, no library.
- **Fade-in on scroll**: subtle `opacity 0 → 1` + `translateY 8px → 0` on content sections. Uses `IntersectionObserver`. 200ms ease-out.
- No other animations — restraint is the aesthetic.

---

## Dark/Light Theme

- Default: system preference via `prefers-color-scheme`
- Toggle: stored in `localStorage`, applied as `class="dark"` on `<html>`
- No flash on load (inline script before body)

---

## Content Notes

All content in the Pencil mockups is placeholder. Real content to be filled in during implementation:
- Bio text (2 paragraphs)
- Blog posts (MDX files)
- Projects data
- Resume (Experience, Education, Awards)

Projects data moves from hardcoded array to a content collection in Astro (`src/content/projects/`).

---

## Out of Scope

- Search
- Comments
- Newsletter/email capture
- Analytics (can add PostHog later)
- i18n
