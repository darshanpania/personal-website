// Pure shelf maths shared by the 3D scene, the flat fallback and the tests.
// All lengths are millimetres unless a name says otherwise.

export type BookFormat = "hardcover" | "paperback" | "mass-market";
export type SpineLayout = "classic" | "band";
export type SpineFont = "serif" | "sans" | "wide";

export interface SpineInput {
  layout?: SpineLayout;
  font?: SpineFont;
  bg?: string;
  fg?: string;
  accent?: string;
  band?: string;
  bandFg?: string;
  bandText?: string;
  title?: string;
  subtitle?: string;
  publisher?: string;
  image?: string;
}

export interface BookInput {
  id: string;
  title: string;
  author: string;
  genre: string;
  series?: string;
  seriesIndex?: number;
  year?: number;
  pages?: number;
  format?: BookFormat;
  cover?: string;
  width?: number;
  height?: number;
  note?: string;
  spine?: SpineInput;
}

export interface Spine {
  layout: SpineLayout;
  font: SpineFont;
  bg: string;
  fg: string;
  accent: string;
  band: string;
  bandFg: string;
  bandText: string;
  title: string;
  subtitle: string;
  publisher: string;
  /** Photo of the real spine, when there is one. */
  image?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  series?: string;
  seriesIndex?: number;
  year?: number;
  pages?: number;
  format: BookFormat;
  cover?: string;
  note?: string;
  /** Cover width, cover height and spine thickness. */
  w: number;
  h: number;
  t: number;
  spine: Spine;
}

const TRIM: Record<BookFormat, { w: number; h: number }> = {
  hardcover: { w: 135, h: 204 },
  paperback: { w: 129, h: 198 },
  "mass-market": { w: 106, h: 175 },
};

// Cloth and jacket colours for books that have no spine colours in the data.
const PALETTE = [
  "#7b2d26", "#1f3a5f", "#2f5d50", "#5a3e6b", "#8a5a1f", "#2b2b2e",
  "#6b1f3a", "#3d5a80", "#4a5d23", "#84563c", "#264653", "#9a3b2e",
];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

export const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Mix a colour toward black (amount < 0) or white (amount > 0). */
export const shade = (hex: string, amount: number) => {
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  return (
    "#" +
    rgb(hex)
      .map((v) => Math.round(v + (target - v) * k).toString(16).padStart(2, "0"))
      .join("")
  );
};

const inkOn = (bg: string) => (luminance(bg) > 0.35 ? "#1c1712" : "#f1e7d0");

export const thickness = (pages: number | undefined, format: BookFormat) => {
  const p = pages ?? 300;
  const t = format === "hardcover" ? p * 0.062 + 8 : p * 0.058 + 2;
  return Math.round(Math.min(Math.max(t, 8), 80) * 10) / 10;
};

const surname = (author: string) => author.trim().split(/\s+/).pop() ?? author;

export function resolveBook(b: BookInput): Book {
  const format = b.format ?? "paperback";
  const s = b.spine ?? {};
  const bg = s.bg ?? PALETTE[hash(b.series ?? b.id) % PALETTE.length];
  const fg = s.fg ?? inkOn(bg);
  const band = s.band ?? shade(bg, luminance(bg) > 0.35 ? -0.55 : -0.4);
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    genre: b.genre,
    series: b.series,
    seriesIndex: b.seriesIndex,
    year: b.year,
    pages: b.pages,
    format,
    cover: b.cover,
    note: b.note,
    w: b.width ?? TRIM[format].w,
    h: b.height ?? TRIM[format].h,
    t: thickness(b.pages, format),
    spine: {
      layout: s.layout ?? (format === "hardcover" ? "classic" : "band"),
      font: s.font ?? (format === "hardcover" ? "serif" : "sans"),
      bg,
      fg,
      accent: s.accent ?? fg,
      band,
      bandFg: s.bandFg ?? inkOn(band),
      bandText: s.bandText ?? surname(b.author),
      title: s.title ?? b.title,
      subtitle: s.subtitle ?? "",
      publisher: s.publisher ?? "",
      image: s.image,
    },
  };
}

export interface Genre {
  name: string;
  books: Book[];
}

/**
 * Genres in order of first appearance. Inside a genre the file order is kept,
 * except that the books of a series stand together, in series order, where
 * the first of them appears.
 */
export function groupByGenre(books: Book[]): Genre[] {
  const genres = new Map<string, Book[]>();
  for (const b of books) {
    if (!genres.has(b.genre)) genres.set(b.genre, []);
    genres.get(b.genre)!.push(b);
  }
  return [...genres].map(([name, list]) => {
    const slots = new Map<string, Book[]>();
    for (const b of list) {
      const key = b.series ? `series:${b.series}` : `book:${b.id}`;
      if (!slots.has(key)) slots.set(key, []);
      slots.get(key)!.push(b);
    }
    const ordered = [...slots.values()].flatMap((group) =>
      group
        .map((book, i) => ({ book, i }))
        .sort(
          (a, b) =>
            (a.book.seriesIndex ?? Infinity) - (b.book.seriesIndex ?? Infinity) || a.i - b.i,
        )
        .map((x) => x.book),
    );
    return { name, books: ordered };
  });
}

export interface PlacedBook {
  book: Book;
  /** Left edge of the spine, measured from the inner left wall of the case. */
  x: number;
}

export interface Row {
  genre: string;
  /** True for the first shelf of a genre: that shelf carries the label. */
  first: boolean;
  books: PlacedBook[];
  /** Right edge of the last book. */
  end: number;
  /** True when there is room for a bookend after the last book. */
  bookend: boolean;
}

export const SHELF = {
  padLeft: 5,
  padRight: 5,
  gap: 0.35,
  bookend: 30,
};

/** Put each genre on its own shelves; a genre wraps when a shelf is full. */
export function packShelves(genres: Genre[], innerWidth: number): Row[] {
  const rows: Row[] = [];
  const limit = innerWidth - SHELF.padRight;
  for (const g of genres) {
    let row: Row = { genre: g.name, first: true, books: [], end: SHELF.padLeft, bookend: false };
    rows.push(row);
    for (const book of g.books) {
      const x = row.books.length ? row.end + SHELF.gap : SHELF.padLeft;
      if (row.books.length && x + book.t > limit) {
        row = { genre: g.name, first: false, books: [], end: SHELF.padLeft, bookend: false };
        rows.push(row);
        row.books.push({ book, x: SHELF.padLeft });
        row.end = SHELF.padLeft + book.t;
      } else {
        row.books.push({ book, x });
        row.end = x + book.t;
      }
    }
  }
  for (const r of rows) r.bookend = r.end + SHELF.bookend <= limit;
  return rows;
}

export interface CaseSize {
  /** Clear height between two boards. */
  clear: number;
  board: number;
  side: number;
  depth: number;
  inner: number;
  outer: number;
  height: number;
}

export function caseSize(rows: Row[], innerWidth: number): CaseSize {
  const tallest = Math.max(180, ...rows.flatMap((r) => r.books.map((p) => p.book.h)));
  const deepest = Math.max(110, ...rows.flatMap((r) => r.books.map((p) => p.book.w)));
  const clear = tallest + 42;
  const board = 24;
  const side = 20;
  return {
    clear,
    board,
    side,
    depth: deepest + 62,
    inner: innerWidth,
    outer: innerWidth + side * 2,
    height: rows.length * clear + (rows.length + 1) * board,
  };
}
