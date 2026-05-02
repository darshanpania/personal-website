# darshanpania.me

A typography-first personal site for [Darshan Pania](https://darshanpania.me). Single column, content-first, minimal chrome. Warm paper background in light mode, cold precise dark in dark mode, with a sage-green / blue mono accent that gives the site its visual personality.

## Tech stack

- **[Astro 5](https://astro.build)** with static output
- **[Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)** via `@tailwindcss/vite`, configured through CSS `@theme` and a small set of root CSS variables
- **[MDX](https://mdxjs.com)** for local long-form posts
- **Geist Sans + Geist Mono** via `@fontsource`
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

```
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
  styles/global.css           Tailwind import, light/dark CSS variables, prose styles, keyframes
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
