// Renders a post into a complete, email-client-safe HTML document.
// Styles are inlined on every tag because most email clients (Gmail, Outlook,
// Yahoo) strip <style> blocks. The Google Fonts <link> is a progressive
// enhancement; system fallbacks in every font-family declaration keep the
// email readable when fonts can't load.
//
// Design tokens mirror src/styles/global.css (light theme only — dark-mode
// emails are a rabbit hole we're not opening for a personal newsletter).

export type RenderPostEmailInput = {
  title: string;
  date: Date;
  slug: string;
  bodyHtml: string;
  coverImage?: string;
  siteUrl?: string;
};

const COLORS = {
  bg: "#faf8f5",
  surface: "#f0ede8",
  border: "#ddd8d0",
  textPrimary: "#18130e",
  textSecondary: "#7c736a",
  monoAccent: "#3d5a80",
} as const;

const FONT_SANS = `'Geist Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const FONT_MONO = `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace`;

const formatDate = (d: Date) =>
  `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Inlines CSS onto known HTML tags produced by `marked`. Limited to the
// elements posts actually use; anything else falls back to the body's
// inherited font/color.
const STYLE_RULES: Array<[RegExp, string]> = [
  [
    /<h1(\s|>)/g,
    `<h1 style="margin:1.6em 0 0.5em;font-size:1.5625rem;font-weight:600;line-height:1.3;color:${COLORS.textPrimary};"$1`,
  ],
  [
    /<h2(\s|>)/g,
    `<h2 style="margin:1.8em 0 0.5em;font-size:1.25rem;font-weight:600;line-height:1.3;color:${COLORS.textPrimary};"$1`,
  ],
  [
    /<h3(\s|>)/g,
    `<h3 style="margin:1.6em 0 0.5em;font-size:1.05rem;font-weight:600;line-height:1.3;color:${COLORS.textPrimary};"$1`,
  ],
  [
    /<p(\s|>)/g,
    `<p style="margin:1.25em 0;color:${COLORS.textPrimary};"$1`,
  ],
  [
    /<a(\s|>)/g,
    `<a style="color:${COLORS.monoAccent};text-decoration:underline;text-underline-offset:4px;"$1`,
  ],
  [
    /<strong(\s|>)/g,
    `<strong style="color:${COLORS.textPrimary};font-weight:600;"$1`,
  ],
  [
    /<ul(\s|>)/g,
    `<ul style="margin:1em 0;padding-left:1.4em;list-style:disc;"$1`,
  ],
  [
    /<ol(\s|>)/g,
    `<ol style="margin:1em 0;padding-left:1.4em;list-style:decimal;"$1`,
  ],
  [/<li(\s|>)/g, `<li style="margin:0.4em 0;"$1`],
  [
    /<blockquote(\s|>)/g,
    `<blockquote style="border-left:2px solid ${COLORS.border};padding-left:1em;color:${COLORS.textSecondary};font-style:italic;margin:1.5em 0;"$1`,
  ],
  [
    /<pre(\s|>)/g,
    `<pre style="font-family:${FONT_MONO};background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:6px;padding:1rem;overflow-x:auto;margin:1.5em 0;font-size:0.875em;line-height:1.5;"$1`,
  ],
  [
    /<code(\s|>)/g,
    `<code style="font-family:${FONT_MONO};font-size:0.875em;background:${COLORS.surface};padding:0.15em 0.4em;border-radius:4px;"$1`,
  ],
  [
    /<hr(\s|\/|>)/g,
    `<hr style="border:0;border-top:1px solid ${COLORS.border};margin:2em 0;"$1`,
  ],
  [
    /<img(\s|>)/g,
    `<img style="max-width:100%;height:auto;border-radius:6px;margin:1.5em 0;"$1`,
  ],
];

export function inlineStyles(html: string): string {
  return STYLE_RULES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), html);
}

export function renderPostEmail(input: RenderPostEmailInput): string {
  const siteUrl = (input.siteUrl ?? "https://darshanpania.me").replace(/\/$/, "");
  const postUrl = `${siteUrl}/blog/${input.slug}`;
  const title = escapeHtml(input.title);
  const styledBody = inlineStyles(input.bodyHtml);
  const coverImg = input.coverImage
    ? `<img src="${escapeHtml(new URL(input.coverImage, siteUrl + "/").href)}" alt="${title}" style="width:100%;max-width:640px;height:auto;border-radius:8px;margin:0 0 2em;display:block;" />`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};color:${COLORS.textPrimary};font-family:${FONT_SANS};-webkit-font-smoothing:antialiased;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;font-size:16px;line-height:1.75;">
${coverImg}
<h1 style="margin:0;font-size:1.5625rem;font-weight:600;line-height:1.3;color:${COLORS.textPrimary};">${title}</h1>
<p style="margin:0.75em 0 2em;font-family:${FONT_MONO};font-size:0.875rem;color:${COLORS.textSecondary};">${formatDate(input.date)}</p>
<div>
${styledBody}
</div>
<hr style="border:0;border-top:1px solid ${COLORS.border};margin:3em 0 2em;" />
<p style="margin:0 0 1em;font-family:${FONT_MONO};font-size:0.875rem;color:${COLORS.textSecondary};">
<a href="${escapeHtml(postUrl)}" style="color:${COLORS.monoAccent};text-decoration:underline;text-underline-offset:4px;">read this on darshanpania.me &rarr;</a>
</p>
<p style="margin:0;font-family:${FONT_MONO};font-size:0.75rem;color:${COLORS.textSecondary};line-height:1.6;">
You're receiving this because you subscribed at <a href="${escapeHtml(siteUrl)}" style="color:${COLORS.monoAccent};text-decoration:underline;">darshanpania.me</a>.
<br />
<a href="{{unsubscribe_url}}" style="color:${COLORS.textSecondary};text-decoration:underline;">unsubscribe</a>
</p>
</div>
</body>
</html>`;
}
