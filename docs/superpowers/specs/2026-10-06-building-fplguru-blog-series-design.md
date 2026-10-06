# "Building FPLGuru" blog series — design spec

**Date:** 2026-10-06
**Branch:** `claude/project-thread-bxmsqb`
**Status:** Approved in brainstorm (2026-10-06), pending spec review

## Summary

A six-post series on darshanpania.me about how FPLGuru was built, from the first
commit on 6 Sep 2024 to the Matchday launch on 6 Oct 2026. The process is the
hero: each post tells one era of the build as a story, goes deep into the tech
where the tech carries the lesson, and leaves engineers, EMs and builders with
methods they can copy. The product and the football come second, but they are
always there, because the readers sit where tech meets sport.

This replaces the plan in fplguru PR #669 (Aug 2026). That PR's drafts and
research dossiers are reference material only. Every post is written again.

## Goals

- Evangelize the build process honestly: what we did, what broke, what we changed,
  and why it worked.
- Sound like Darshan. A builder's diary, in first person, tuned to his published
  posts on this site.
- Give developers enough real detail (numbers, configs, file names, failure modes)
  to be inspired to build, and enough story that EMs and FPL managers keep reading.
- Every fact is verifiable against the fplguru git history, a repo file, or a
  named Notion page.

## Non-goals

- Marketing copy for FPLGuru. Calls to action stay at the end of a post and stay small.
- A word limit. Posts are deep dives and run as long as the story needs, but no
  section stays in a post unless it earns its place.
- Site code changes (series navigation, tags, new schema fields). The series is
  linked by hand: a series line at the top and bottom of each post.
- Social adaptations (X, LinkedIn). Those can follow later.

## Decisions (locked during brainstorm)

| # | Question | Decision |
|---|---|---|
| 1 | What to do with the PR #669 drafts | Reference only; rewrite every post, improve the voice |
| 2 | Voice | Builder's diary: first person, honest, real numbers and mistakes |
| 3 | Where the posts live | darshanpania.me, as local MDX posts |
| 4 | Length | No limit; deep dives; cut what does not earn its place |
| 5 | Matchday post angle | Scale first; process and product get a real mention; Darshan's role is a small part |
| 6 | Review | Drafts in a PR on this repo, as `.mdx` files with `draft: true` |
| 7 | Order | Time order, 1 to 6; Matchday is the payoff |
| 8 | Theme | Genuine evangelization of the tech process followed over the years |
| 9 | Audience | Tech and sport; mainly engineers, EMs and builders; story form with tech depth where needed |

## The series

Series name: **Building FPLGuru**. Each post opens with a one-line series marker
("Part N of Building FPLGuru") and ends with a link to the next post once it exists.

| # | Working title | Era | The process lesson it carries |
|---|---|---|---|
| 1 | From a GPT-4 prompt to FPLGuru | 2023 to Feb 2026 | A side project survives on small, shipped loops; three frontends and a near-death year |
| 2 | Teaching a machine to play FPL | Apr to Aug 2026 | ML in production: heuristics to XGBoost expected points, shadow mode and flags, fplv1 to fplv4 on a Mac Mini |
| 3 | My co-founders are robots | Feb to Sep 2026 | The agentic workflow: Claude builds, Codex reviews, spec first, TDD, planner/advisor/builder, loop control, local CI |
| 4 | Why an analytics app ships trivia games | May to Sep 2026 | Growth through anonymous-first games; a knowledge graph; share cards as distribution |
| 5 | AI that doesn't make up your captain | Feb to Oct 2026 | Trust as architecture: grounded chat, typed artifacts, one-brain tool routing, MCP and Connect AI |
| 6 | Matchday: a new product in a week | 27 Sep to 6 Oct 2026 | Scale with Opus 5.5: the design package, the P0 to P8 tracker, many parallel threads, Codex review and auto-merge |

Titles are working titles; final titles are chosen per post with Darshan.

### Anchor facts (verified 2026-10-06 against `origin/develop` of darshanpania/fplguru)

- First commit: 2024-09-06 ("First commit"). Total commits by 2026-10-06: 10,991.
- Commits per month: Sep 2024 2, Mar 2025 25, Feb 2026 78, Apr 2026 455, Jun 2026 743,
  Aug 2026 1,334, Sep 2026 5,106, 1 to 5 Oct 2026 2,045.
- First Claude-authored commit: 2026-02-14. First Codex Automation commit: 2026-06-25.
- First spec under `docs/superpowers/specs`: 2026-04-10. Advisor model defined:
  2026-07-01. Olympus configured: 2026-08-28. Local CI for develop PRs: 2026-09-25.
- Since 2026-09-01, by author: Claude 4,056, Codex Automation 2,120, Divyekant Gupta
  786, Darshan Pania 166. 3,551 commit bodies carry a Claude co-author line.
- Matchday scale: from 2026-09-28 to 2026-10-06, 2,640 files changed,
  +203,175 / −180,530 lines.

Each post re-checks the numbers it uses at drafting time and states the date.

## Voice guide

Built from the published posts on this site (`the-last-of-us-engineering-managers`,
`smarter-tools-dumber-us`, `rainsurfer-stopped-hoarding-bookmarks`).

- First person, conversational, direct. Opens on a concrete moment, not a thesis.
- Admits mistakes plainly ("and honestly, ..."). No hype words, no "revolutionize",
  no "game-changer", no "delve", no rule-of-three lists for rhythm.
- Short paragraphs. Mostly prose; headings only where a deep dive needs a map.
- Technical detail is shown, not described: the real file name, the real number,
  the real bug, a short code or config block when it is the point.
- Closes on a personal reflection, not a summary.
- Darshan's own phrasing from the interviews is kept wherever it works.

## Process per post

1. **Research.** Read the matching PR #669 dossier or draft (if any), the fplguru
   docs and specs for the era, git history, and Notion (Blog Seeds, Build Log).
   Write short notes with sources; nothing unverified goes in a post.
2. **Interview.** Ask Darshan 3 to 5 questions in the project thread, one at a
   time: the moments, opinions and memories only he has.
3. **Outline.** Share a short outline in the thread and adjust it.
4. **Draft.** Write the post as `src/content/posts/building-fplguru-<n>-<slug>.mdx`
   with `draft: true`, `category: tech`, a `description`, and no `coverImage` until
   one exists.
5. **Review.** Darshan reviews on the PR; changes are pushed to the same branch.

## Publishing and the newsletter

The `newsletter-draft` workflow creates an Autosend draft only for post files
**added** to `main` (`git diff --diff-filter=A`), and it skips a file whose front
matter has `draft: true`. A post merged as a draft and published later by flipping
the flag would therefore never get a newsletter draft.

So posts never reach `main` as drafts:

- The review PR (this branch) carries the spec and the drafts. It is never merged
  while it contains a `draft: true` post.
- To publish a post, a small publish PR adds only that post's file with
  `draft: false` (plus any cover image). The newsletter workflow then drafts it as
  usual, and Darshan approves the campaign.
- The review branch is rebased after each publish so the published file is not
  added twice. When all six are published, the review PR merges with the spec only.

## Verification

- `npm run build` passes with every draft in place (schema check of front matter).
- Every number in a post is traceable to a command, file or Notion page listed in
  the post's research notes on the PR.
- Names: Divyekant's work is credited by name where the dossiers credit it; no
  other private person is named without Darshan's OK.
- Sensitive details from PR #669's cautions stay out: no tunnel hostnames, ports,
  service names, secrets, or user data.

## Open items

- Cover images per post (not required to publish; schema allows none).
- Final titles, chosen with Darshan per post.
