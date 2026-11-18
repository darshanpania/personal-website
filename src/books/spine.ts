// Draws book spines, covers and shelf labels on 2D canvases. The 3D scene
// uses them as textures.
import type { Book, SpineFont } from "./layout";

const FONT: Record<SpineFont, { family: string; weight: number; caps: boolean; spacing: number }> = {
  serif: { family: '"Libre Caslon Text", Georgia, serif', weight: 700, caps: true, spacing: 0.06 },
  sans: { family: '"Geist Sans", system-ui, sans-serif', weight: 600, caps: true, spacing: 0.08 },
  wide: { family: '"Michroma", "Geist Sans", sans-serif', weight: 400, caps: true, spacing: 0.04 },
  condensed: { family: '"Oswald", "Geist Sans", sans-serif', weight: 500, caps: true, spacing: 0.05 },
  display: { family: '"Playfair Display", Georgia, serif', weight: 700, caps: false, spacing: 0.01 },
};

/** Wait for the faces the canvases draw with, so no spine falls back to a system font. */
export async function loadSpineFonts() {
  if (!document.fonts?.load) return;
  const faces = [
    '700 20px "Libre Caslon Text"',
    'italic 400 20px "Libre Caslon Text"',
    '400 20px "Libre Caslon Text"',
    '400 20px "Michroma"',
    '500 20px "Oswald"',
    '700 20px "Playfair Display"',
    '600 20px "Geist Sans"',
    '500 20px "Geist Sans"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => [])));
}

type Ctx = CanvasRenderingContext2D;

const setSpacing = (ctx: Ctx, px: number) => {
  // Not in every browser; the text is still fine without it.
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = `${px.toFixed(2)}px`;
};

interface Line {
  text: string;
  font: string;
  size: number;
  spacing: number;
  color: string;
}

/** Largest size (up to `max`) at which the text fits in `length`. */
function fit(ctx: Ctx, text: string, fontAt: (px: number) => string, max: number, length: number, spacing: number) {
  let size = max;
  for (let i = 0; i < 6; i++) {
    ctx.font = fontAt(size);
    setSpacing(ctx, size * spacing);
    const w = ctx.measureText(text).width;
    if (w <= length) break;
    size *= Math.max(0.6, (length / w) * 0.985);
  }
  return size;
}

/** Text that runs down the spine: the tops of the letters point to the front cover. */
function down(ctx: Ctx, line: Line, cx: number, y: number, align: CanvasTextAlign = "left") {
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(Math.PI / 2);
  ctx.font = line.font;
  setSpacing(ctx, line.size * line.spacing);
  ctx.fillStyle = line.color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(line.text, 0, line.size * 0.04);
  ctx.restore();
}

function grain(ctx: Ctx, w: number, h: number, seed: number, strength: number) {
  // Fine paper tooth and a little handling wear, so the spine is not a flat fill.
  let s = seed || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * strength;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const edge = ctx.createLinearGradient(0, 0, 0, h);
  edge.addColorStop(0, "rgba(255,255,255,0.10)");
  edge.addColorStop(0.012, "rgba(255,255,255,0)");
  edge.addColorStop(0.988, "rgba(255,255,255,0)");
  edge.addColorStop(1, "rgba(255,255,255,0.10)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}

const seedOf = (id: string) => {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};

function publisherMark(ctx: Ctx, book: Book, W: number, H: number, color: string) {
  const text = book.spine.publisher.toUpperCase();
  const y = H * 0.957;
  if (text) {
    const size = Math.min(W * 0.2, H * 0.016);
    ctx.font = `600 ${size}px "Geist Sans", system-ui, sans-serif`;
    setSpacing(ctx, size * 0.12);
    if (size >= 7 && ctx.measureText(text).width <= W * 0.9) {
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, W / 2 + size * 0.06, y);
      return;
    }
  }
  // Too narrow for a name: a small device, as publishers print on thin spines.
  const r = Math.min(W * 0.16, H * 0.012);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(W / 2, y - r);
  ctx.lineTo(W / 2 + r * 0.72, y);
  ctx.lineTo(W / 2, y + r);
  ctx.lineTo(W / 2 - r * 0.72, y);
  ctx.closePath();
  ctx.fill();
}

function classic(ctx: Ctx, book: Book, W: number, H: number) {
  const s = book.spine;
  const f = FONT[s.font];
  const head = f.caps ? s.title.toUpperCase() : s.title;
  const sub = s.subtitle;
  const author = book.author.toUpperCase();

  // Rules at head and foot.
  ctx.fillStyle = s.fg;
  const rule = Math.max(1.5, H * 0.0022);
  for (const y of [H * 0.03, H * 0.925]) {
    ctx.fillRect(W * 0.1, y, W * 0.8, rule);
    ctx.fillRect(W * 0.1, y + rule * 2.4, W * 0.8, rule * 0.5);
  }

  const top = H * 0.06;
  const titleLen = H * (sub ? 0.56 : 0.5);
  const headFont = (px: number) => `${f.weight} ${px}px ${f.family}`;
  const subFont = (px: number) => `italic 400 ${px}px "Libre Caslon Text", Georgia, serif`;

  if (sub && W >= 150) {
    // Wide spine: title and subtitle on two lines.
    const hs = fit(ctx, head, headFont, W * 0.36, titleLen, f.spacing);
    const ss = fit(ctx, sub, subFont, W * 0.25, titleLen, 0.01);
    down(ctx, { text: head, font: headFont(hs), size: hs, spacing: f.spacing, color: s.fg }, W * 0.64, top);
    down(ctx, { text: sub, font: subFont(ss), size: ss, spacing: 0.01, color: s.accent }, W * 0.27, top);
  } else if (sub) {
    // One line: the title, then the subtitle a little smaller.
    let hs = Math.min(W * 0.46, H * 0.05);
    let ss = hs * 0.74;
    for (let i = 0; i < 6; i++) {
      ctx.font = headFont(hs);
      setSpacing(ctx, hs * f.spacing);
      const hw = ctx.measureText(head).width;
      ctx.font = subFont(ss);
      setSpacing(ctx, ss * 0.01);
      const total = hw + hs * 0.45 + ctx.measureText(sub).width;
      if (total <= titleLen) break;
      const k = Math.max(0.6, (titleLen / total) * 0.985);
      hs *= k;
      ss *= k;
    }
    ctx.font = headFont(hs);
    setSpacing(ctx, hs * f.spacing);
    const hw = ctx.measureText(head).width;
    down(ctx, { text: head, font: headFont(hs), size: hs, spacing: f.spacing, color: s.fg }, W / 2, top);
    down(ctx, { text: sub, font: subFont(ss), size: ss, spacing: 0.01, color: s.accent }, W / 2, top + hw + hs * 0.45);
  } else {
    const hs = fit(ctx, head, headFont, Math.min(W * 0.46, H * 0.05), titleLen, f.spacing);
    down(ctx, { text: head, font: headFont(hs), size: hs, spacing: f.spacing, color: s.fg }, W / 2, top);
  }

  const aFont = (px: number) => `400 ${px}px "Libre Caslon Text", Georgia, serif`;
  const as = fit(ctx, author, aFont, Math.min(W * 0.3, H * 0.03), H * 0.24, 0.14);
  down(ctx, { text: author, font: aFont(as), size: as, spacing: 0.14, color: s.accent }, W / 2, H * 0.905, "right");

  publisherMark(ctx, book, W, H, s.fg);
}

function band(ctx: Ctx, book: Book, W: number, H: number) {
  const s = book.spine;
  const f = FONT[s.font];
  const fontAt = (px: number) => `${f.weight} ${px}px ${f.family}`;
  const bandEnd = H * 0.3;

  ctx.fillStyle = s.band;
  ctx.fillRect(0, 0, W, bandEnd);
  ctx.fillStyle = s.bandFg;
  ctx.fillRect(0, bandEnd, W, Math.max(2, H * 0.004));

  const name = s.bandText.toUpperCase();
  const ns = fit(ctx, name, fontAt, W * 0.52, bandEnd - H * 0.06, f.spacing);
  down(ctx, { text: name, font: fontAt(ns), size: ns, spacing: f.spacing, color: s.bandFg }, W / 2, H * 0.03);

  const title = f.caps ? s.title.toUpperCase() : s.title;
  const ts = fit(ctx, title, fontAt, W * 0.36, H * 0.56, f.spacing + 0.04);
  down(ctx, { text: title, font: fontAt(ts), size: ts, spacing: f.spacing + 0.04, color: s.fg }, W / 2, bandEnd + H * 0.035);

  publisherMark(ctx, book, W, H, s.fg);
}

/** Words across a thick spine, one under the other. Returns false when they do not fit. */
function stacked(
  ctx: Ctx,
  text: string,
  fontAt: (px: number) => string,
  spacing: number,
  color: string,
  W: number,
  top: number,
  maxHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  const size = fit(ctx, longest, fontAt, W * 0.26, W * 0.8, spacing);
  if (size < W * 0.12 || words.length * size * 1.2 > maxHeight) return false;
  ctx.font = fontAt(size);
  setSpacing(ctx, size * spacing);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  words.forEach((word, i) => ctx.fillText(word, W / 2 + (size * spacing) / 2, top + size * (0.6 + i * 1.2)));
  return true;
}

/**
 * A title that runs down the spine: on one line, or on two when one line
 * would be too small to read and the spine is wide enough.
 */
function titleLines(
  ctx: Ctx,
  text: string,
  fontAt: (px: number) => string,
  spacing: number,
  W: number,
  length: number,
  max: number,
) {
  const one = fit(ctx, text, fontAt, max, length, spacing);
  const words = text.split(/\s+/);
  if (one >= max * 0.62 || words.length < 3 || W < 64) return { lines: [text], size: one };
  let best = 1;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    const b = Math.abs(words.slice(0, best).join(" ").length - words.slice(best).join(" ").length);
    if (d < b) best = i;
  }
  const lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  const cap = Math.min(max, W * 0.3);
  const size = Math.min(...lines.map((l) => fit(ctx, l, fontAt, cap, length, spacing)));
  return size > one * 1.12 ? { lines, size } : { lines: [text], size: one };
}

/** Draw the lines of `titleLines` from `y` down. Returns the length of the longest line. */
function drawTitle(
  ctx: Ctx,
  t: { lines: string[]; size: number },
  fontAt: (px: number) => string,
  spacing: number,
  color: string,
  W: number,
  y: number,
) {
  let longest = 0;
  t.lines.forEach((text, i) => {
    // The first line is the one nearer the front cover.
    const cx = t.lines.length === 1 ? W / 2 : W / 2 + (i === 0 ? 1 : -1) * t.size * 0.62;
    down(ctx, { text, font: fontAt(t.size), size: t.size, spacing, color }, cx, y);
    ctx.font = fontAt(t.size);
    setSpacing(ctx, t.size * spacing);
    longest = Math.max(longest, ctx.measureText(text).width);
  });
  return longest;
}

/** Title and author on a plain ground: the spine of most paperbacks. */
function titleAndAuthor(
  ctx: Ctx,
  book: Book,
  W: number,
  top: number,
  bottom: number,
  colors: { title: string; author: string },
) {
  const s = book.spine;
  const f = FONT[s.font];
  const fontAt = (px: number) => `${f.weight} ${px}px ${f.family}`;
  const authorAt = (px: number) =>
    s.font === "serif" || s.font === "display"
      ? `400 ${px}px "Libre Caslon Text", Georgia, serif`
      : `500 ${px}px "Geist Sans", system-ui, sans-serif`;
  const title = f.caps ? s.title.toUpperCase() : s.title;
  const author = book.author.toUpperCase();
  const len = bottom - top;
  const style = seedOf(book.series ?? book.author);

  if (W >= 185 && stacked(ctx, title, fontAt, f.spacing, colors.title, W, top + len * 0.04, len * 0.5)) {
    const name = surnameOf(book.author).toUpperCase();
    const as = fit(ctx, name, authorAt, W * 0.13, W * 0.8, 0.1);
    ctx.font = authorAt(as);
    setSpacing(ctx, as * 0.1);
    ctx.fillStyle = colors.author;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, W / 2 + as * 0.05, bottom - as);
    return;
  }

  const big = Math.min(W * (s.font === "condensed" ? 0.58 : 0.48), len * 0.075);
  if (style % 3 === 0) {
    // Author first, then the title.
    const as = fit(ctx, author, authorAt, big * 0.62, len * 0.3, 0.1);
    down(ctx, { text: author, font: authorAt(as), size: as, spacing: 0.1, color: colors.author }, W / 2, top);
    ctx.font = authorAt(as);
    setSpacing(ctx, as * 0.1);
    const used = Math.min(len * 0.3, ctx.measureText(author).width) + big * 0.9;
    drawTitle(ctx, titleLines(ctx, title, fontAt, f.spacing, W, len - used, big), fontAt, f.spacing, colors.title, W, top + used);
  } else {
    // Title at the head, author at the foot.
    drawTitle(ctx, titleLines(ctx, title, fontAt, f.spacing, W, len * 0.62, big), fontAt, f.spacing, colors.title, W, top);
    const as = fit(ctx, author, authorAt, big * 0.6, len * 0.32, 0.1);
    down(ctx, { text: author, font: authorAt(as), size: as, spacing: 0.1, color: colors.author }, W / 2, bottom, "right");
  }
}

const surnameOf = (author: string) => author.trim().split(/\s+/).pop() ?? author;

function plain(ctx: Ctx, book: Book, W: number, H: number) {
  const s = book.spine;
  if (seedOf(book.series ?? book.author) % 2) {
    // A thin rule at the head and the foot.
    ctx.fillStyle = s.accent;
    ctx.fillRect(0, H * 0.018, W, Math.max(2, H * 0.004));
    ctx.fillRect(0, H * 0.925, W, Math.max(2, H * 0.004));
  }
  titleAndAuthor(ctx, book, W, H * 0.045, H * 0.9, { title: s.fg, author: s.accent });
  publisherMark(ctx, book, W, H, s.fg);
}

/** A block of the second colour at the foot, with the publisher's mark in it. */
function block(ctx: Ctx, book: Book, W: number, H: number) {
  const s = book.spine;
  const from = H * 0.84;
  ctx.fillStyle = s.band;
  ctx.fillRect(0, from, W, H - from);
  ctx.fillRect(0, 0, W, H * 0.022);
  titleAndAuthor(ctx, book, W, H * 0.05, from - H * 0.03, { title: s.fg, author: s.accent });
  publisherMark(ctx, book, W, H, s.bandFg);
}

/** The title on a panel of the second colour, as on many classics. */
function label(ctx: Ctx, book: Book, W: number, H: number) {
  const s = book.spine;
  const f = FONT[s.font];
  const fontAt = (px: number) => `${f.weight} ${px}px ${f.family}`;
  const inset = Math.max(3, W * 0.1);
  const top = H * 0.07;
  const height = H * 0.5;
  ctx.fillStyle = s.band;
  ctx.fillRect(inset, top, W - inset * 2, height);
  ctx.strokeStyle = s.bandFg;
  ctx.lineWidth = Math.max(1, W * 0.012);
  ctx.strokeRect(inset + W * 0.05, top + W * 0.05, W - inset * 2 - W * 0.1, height - W * 0.1);
  const title = f.caps ? s.title.toUpperCase() : s.title;
  if (!(W >= 185 && stacked(ctx, title, fontAt, f.spacing, s.bandFg, W, top + height * 0.12, height * 0.76))) {
    const room = height - Math.max(W * 0.3, H * 0.03);
    const t = titleLines(ctx, title, fontAt, f.spacing, W - inset * 2, room, (W - inset * 2) * 0.5);
    ctx.font = fontAt(t.size);
    setSpacing(ctx, t.size * f.spacing);
    const tw = Math.max(...t.lines.map((l) => ctx.measureText(l).width));
    drawTitle(ctx, t, fontAt, f.spacing, s.bandFg, W, top + (height - tw) / 2);
  }
  const author = book.author.toUpperCase();
  const authorAt = (px: number) => `400 ${px}px "Libre Caslon Text", Georgia, serif`;
  const as = fit(ctx, author, authorAt, Math.min(W * 0.3, H * 0.03), H * 0.26, 0.12);
  down(ctx, { text: author, font: authorAt(as), size: as, spacing: 0.12, color: s.accent }, W / 2, top + height + H * 0.035);
  publisherMark(ctx, book, W, H, s.fg);
}

/** The white lines a paperback spine gets from being read. */
function creases(ctx: Ctx, book: Book, W: number, H: number) {
  if (book.format === "hardcover") return;
  let s = seedOf(`wear:${book.id}`) || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const count = Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const x = W * (0.12 + rnd() * 0.76);
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.09})`;
    ctx.lineWidth = 0.8 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let y = 0;
    let dx = 0;
    while (y < H) {
      y += H * 0.08;
      dx += (rnd() - 0.5) * W * 0.03;
      ctx.lineTo(x + dx, y);
    }
    ctx.stroke();
  }
}

/** A spine `pxPerMm` pixels per millimetre: the canvas is thickness by height. */
export function drawSpine(book: Book, pxPerMm = 5): HTMLCanvasElement {
  const W = Math.max(16, Math.round(book.t * pxPerMm));
  const H = Math.round(book.h * pxPerMm);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = book.spine.bg;
  ctx.fillRect(0, 0, W, H);
  const draw = { classic, band, plain, block, label }[book.spine.layout];
  draw(ctx, book, W, H);
  creases(ctx, book, W, H);
  grain(ctx, W, H, seedOf(book.id), 9);
  return canvas;
}

function wrap(ctx: Ctx, text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A plain typographic cover for a book that has no cover image yet. */
export function drawPlainCover(book: Book): HTMLCanvasElement {
  const W = 512;
  const H = Math.round((W * book.h) / book.w);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const s = book.spine;
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = s.fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.lineWidth = 1;
  ctx.strokeRect(38, 38, W - 76, H - 76);

  ctx.fillStyle = s.fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let size = 54;
  let lines: string[] = [];
  for (; size > 26; size -= 4) {
    ctx.font = `700 ${size}px "Libre Caslon Text", Georgia, serif`;
    lines = wrap(ctx, book.title, W - 120);
    if (lines.length <= 5) break;
  }
  let y = H * 0.3;
  for (const l of lines) {
    ctx.fillText(l, W / 2, y);
    y += size * 1.22;
  }
  ctx.fillRect(W / 2 - 40, y - size * 0.4, 80, 2);
  ctx.fillStyle = s.accent;
  ctx.font = `400 26px "Libre Caslon Text", Georgia, serif`;
  setSpacing(ctx, 3);
  ctx.fillText(book.author.toUpperCase(), W / 2, H * 0.86);
  grain(ctx, W, H, seedOf(book.id), 8);
  return canvas;
}

/** A brass card holder with the genre on a paper card, for the front edge of a board. */
export function drawLabel(text: string, w = 672, h = 132): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#dcbc78");
  g.addColorStop(0.5, "#b8924a");
  g.addColorStop(1, "#8f6c2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Brushed lines on the brass.
  let s = 99;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? "255,240,200" : "60,40,10"},${0.04 + rnd() * 0.06})`;
    ctx.fillRect(rnd() * w - 80, rnd() * h, 60 + rnd() * 260, 1);
  }
  // The card, a little in shadow under the top lip of the holder.
  const f = 11;
  ctx.fillStyle = "#f4ecd9";
  ctx.fillRect(f, f, w - f * 2, h - f * 2);
  const lip = ctx.createLinearGradient(0, f, 0, f + 16);
  lip.addColorStop(0, "rgba(40,26,6,0.4)");
  lip.addColorStop(1, "rgba(40,26,6,0)");
  ctx.fillStyle = lip;
  ctx.fillRect(f, f, w - f * 2, 16);
  ctx.strokeStyle = "rgba(60,40,10,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(f, f, w - f * 2, h - f * 2);

  const label = text.toUpperCase();
  const fontAt = (px: number) => `600 ${px}px "Geist Sans", system-ui, sans-serif`;
  const size = fit(ctx, label, fontAt, h * 0.47, w - f * 2 - 34, 0.07);
  ctx.font = fontAt(size);
  setSpacing(ctx, size * 0.07);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#231a10";
  ctx.fillText(label, w / 2 + size * 0.035, h / 2 + size * 0.04);
  return canvas;
}

/** Stripes for the page edges of a book block. */
export function drawPageEdges(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  let s = 5;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let x = 0; x < 128; x++) {
    const v = 205 + Math.round(rnd() * 50);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, 8);
  }
  return canvas;
}
