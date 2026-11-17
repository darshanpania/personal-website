// Draws book spines, covers and shelf labels on 2D canvases. The 3D scene
// uses them as textures.
import type { Book, SpineFont } from "./layout";

const FONT: Record<SpineFont, { family: string; weight: number; caps: boolean; spacing: number }> = {
  serif: { family: '"Libre Caslon Text", Georgia, serif', weight: 700, caps: true, spacing: 0.06 },
  sans: { family: '"Geist Sans", system-ui, sans-serif', weight: 600, caps: true, spacing: 0.08 },
  wide: { family: '"Michroma", "Geist Sans", sans-serif', weight: 400, caps: true, spacing: 0.04 },
};

/** Wait for the faces the canvases draw with, so no spine falls back to a system font. */
export async function loadSpineFonts() {
  if (!document.fonts?.load) return;
  const faces = [
    '700 20px "Libre Caslon Text"',
    'italic 400 20px "Libre Caslon Text"',
    '400 20px "Libre Caslon Text"',
    '400 20px "Michroma"',
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
  if (book.spine.layout === "band") band(ctx, book, W, H);
  else classic(ctx, book, W, H);
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

/** A small brass plate with the genre name, for the front edge of a shelf. */
export function drawLabel(text: string, w = 640, h = 144): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#d9b871");
  g.addColorStop(0.45, "#c19a4e");
  g.addColorStop(1, "#a17c38");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Brushed lines.
  let s = 99;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? "255,240,200" : "60,40,10"},${0.03 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * w - 80, rnd() * h, 60 + rnd() * 260, 1);
  }
  ctx.strokeStyle = "rgba(70,48,14,0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  for (const x of [30, w - 30]) {
    ctx.fillStyle = "#7d5f27";
    ctx.beginPath();
    ctx.arc(x, h / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(40,26,6,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 5, h / 2 - 3);
    ctx.lineTo(x + 5, h / 2 + 3);
    ctx.stroke();
  }
  const label = text.toUpperCase();
  const fontAt = (px: number) => `600 ${px}px "Geist Sans", system-ui, sans-serif`;
  const size = fit(ctx, label, fontAt, h * 0.42, w - 130, 0.2);
  ctx.font = fontAt(size);
  setSpacing(ctx, size * 0.2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,236,190,0.5)";
  ctx.fillText(label, w / 2 + size * 0.1, h / 2 + 3.5);
  ctx.fillStyle = "#2c2010";
  ctx.fillText(label, w / 2 + size * 0.1, h / 2 + 2);
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
