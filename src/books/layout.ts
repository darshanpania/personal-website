// Pure shelf maths shared by the 3D scene, the flat fallback and the tests.
// All lengths are millimetres unless a name says otherwise.

export type BookFormat = "hardcover" | "paperback" | "mass-market";
export type SpineLayout = "classic" | "band" | "plain" | "block" | "label";
export type SpineFont = "serif" | "sans" | "wide" | "condensed" | "display";

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
  rating?: number;
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
  /** Stars out of five. */
  rating?: number;
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

// Spine designs for books that do not name one. A publisher gives every book
// of an author or a series the same design, so the choice hangs on that name.
const DESIGNS: { layout: SpineLayout; font: SpineFont }[] = [
  { layout: "plain", font: "sans" },
  { layout: "plain", font: "serif" },
  { layout: "plain", font: "condensed" },
  { layout: "plain", font: "display" },
  { layout: "band", font: "sans" },
  { layout: "band", font: "condensed" },
  { layout: "block", font: "sans" },
  { layout: "block", font: "display" },
  { layout: "label", font: "serif" },
  { layout: "label", font: "condensed" },
];

export function resolveBook(b: BookInput): Book {
  const format = b.format ?? "paperback";
  const s = b.spine ?? {};
  const bg = s.bg ?? PALETTE[hash(b.series ?? b.id) % PALETTE.length];
  const fg = s.fg ?? inkOn(bg);
  const band = s.band ?? shade(bg, luminance(bg) > 0.35 ? -0.55 : -0.4);
  const design =
    format === "hardcover"
      ? { layout: "classic" as const, font: "serif" as const }
      : DESIGNS[hash(`design:${b.series ?? b.author}`) % DESIGNS.length];
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
    rating: b.rating,
    w: b.width ?? TRIM[format].w,
    h: b.height ?? TRIM[format].h,
    t: thickness(b.pages, format),
    spine: {
      layout: s.layout ?? design.layout,
      font: s.font ?? design.font,
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
  /** Left edge of the spine, measured from the inner left wall of the cell. */
  x: number;
  /**
   * Radians the book leans to the left, against the book before it. Only the
   * last book of a cell leans. `x` is then where its bottom left corner rests.
   */
  lean: number;
}

export interface CellLabel {
  genre: string;
  /** Where the label starts, measured like a book's `x`. */
  x: number;
}

/** One compartment of the bookcase: one bay wide, one shelf high. */
export interface Cell {
  books: PlacedBook[];
  /** One label for each genre that stands in the cell. */
  labels: CellLabel[];
  /** A steel plate stands at each of these places, between two genres or at the end. */
  plates: number[];
  /** Right edge of the last book, as it would be with every book upright. */
  end: number;
}

export const SHELF = {
  padLeft: 4,
  padRight: 4,
  /** Air between two books. */
  gap: 0.35,
  /** Space for the plate that stands between two genres in one cell. */
  divider: 26,
  /** Width of a label holder on the front edge of a board. */
  label: 112,
  /** A genre that fills more than one cell leaves this share of each cell free. */
  fill: 0.9,
};

const runWidth = (books: Book[]) =>
  books.reduce((sum, b) => sum + b.t, 0) + Math.max(0, books.length - 1) * SHELF.gap;

/** Cut a list of books into `n` runs of about the same width. No run is wider than `limit`. */
function split(books: Book[], n: number, limit: number): Book[][] {
  const runs: Book[][] = [];
  let rest = books;
  for (let i = n; i > 1 && rest.length; i--) {
    const target = Math.min(limit, runWidth(rest) / i);
    let take = 1;
    while (take < rest.length - (i - 1) && runWidth(rest.slice(0, take + 1)) <= target + rest[take].t / 2) take++;
    while (take > 1 && runWidth(rest.slice(0, take)) > limit) take--;
    runs.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  if (rest.length) runs.push(rest);
  return runs;
}

/**
 * Put the genres into cells of `cellWidth`. A genre starts in the cell of the
 * genre before it only when all of it fits there; a genre that is too long
 * for one cell is shared out evenly over as many cells as it needs. The
 * number of cells is a multiple of `bays`, so no cell of the case is empty.
 */
export function packCells(genres: Genre[], cellWidth: number, bays = 1): Cell[] {
  const usable = cellWidth - SHELF.padLeft - SHELF.padRight;
  // A group is one or more whole genres in one cell, or one genre over several cells.
  type Group = { genres: Genre[]; cells: number; width: number };
  const groups: Group[] = [];
  for (const g of genres) {
    if (!g.books.length) continue;
    const width = runWidth(g.books);
    const last = groups[groups.length - 1];
    if (last && last.cells === 1 && last.width + SHELF.divider + width <= usable) {
      last.genres.push(g);
      last.width += SHELF.divider + width;
      continue;
    }
    let cells = Math.max(1, Math.ceil(width / (usable * SHELF.fill)));
    while (split(g.books, cells, usable).some((run) => runWidth(run) > usable)) cells++;
    groups.push({ genres: [g], cells, width });
  }

  // Fill the last shelf: the fullest genre gets one more cell until the count fits.
  const total = () => groups.reduce((n, g) => n + g.cells, 0);
  while (groups.length && total() % bays !== 0) {
    const alone = groups.filter((g) => g.genres.length === 1 && g.genres[0].books.length > g.cells);
    if (!alone.length) break;
    alone.sort((a, b) => b.width / b.cells - a.width / a.cells)[0].cells++;
  }

  const cells: Cell[] = [];
  for (const group of groups) {
    const runs: { genre: string; books: Book[] }[][] =
      group.genres.length > 1 || group.cells === 1
        ? [group.genres.map((g) => ({ genre: g.name, books: g.books }))]
        : split(group.genres[0].books, group.cells, usable).map((books) => [
            { genre: group.genres[0].name, books },
          ]);
    for (const parts of runs) {
      const cell: Cell = { books: [], labels: [], plates: [], end: SHELF.padLeft };
      parts.forEach((part, i) => {
        let x = cell.end;
        if (i > 0) {
          cell.plates.push(x + 6);
          x += SHELF.divider;
        }
        cell.labels.push({ genre: part.genre, x });
        for (const book of part.books) {
          cell.books.push({ book, x, lean: 0 });
          x += book.t + SHELF.gap;
        }
        cell.end = x - SHELF.gap;
      });
      finish(cell, cellWidth);
      cells.push(cell);
    }
  }
  while (cells.length % bays !== 0) cells.push({ books: [], labels: [], plates: [], end: SHELF.padLeft });

  // Two labels in one cell must not overlap, and no label may run past the cell.
  for (const cell of cells) {
    let min = SHELF.padLeft;
    for (const label of cell.labels) {
      label.x = Math.max(min, Math.min(label.x, cellWidth - SHELF.padRight - SHELF.label));
      min = label.x + SHELF.label + 6;
    }
  }
  return cells;
}

/** The free end of a row: the last book leans on its neighbour, or a plate holds the row. */
function finish(cell: Cell, cellWidth: number) {
  const free = cellWidth - SHELF.padRight - cell.end;
  const last = cell.books[cell.books.length - 1];
  const before = cell.books[cell.books.length - 2];
  if (!last || !before || free < 24) return;
  const sameRun = cell.plates.every((p) => p < before.x);
  // Thin and thick books slump; the choice is steady for a given book.
  if (sameRun && last.book.t <= 34 && hash(`end:${last.book.id}`) % 3 !== 0) {
    const reach = Math.min(free - 3, last.book.h * 0.2);
    const lean = Math.asin(reach / last.book.h);
    // The book touches its neighbour with its top corner, or the neighbour's top corner with its face.
    const shift = Math.min(last.book.h * Math.sin(lean), before.book.h * Math.tan(lean));
    last.lean = lean;
    last.x = before.x + before.book.t + shift;
  } else if (free >= 30) {
    cell.plates.push(cell.end + 1.2);
  }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * How the case is built for a stage of `cssW` CSS pixels: the number of bays,
 * the inner width of one bay (mm) and the wall left free on each side (m).
 * A phone gets one bay as wide as the screen allows; a wide window gets three.
 */
export function casePlan(cssW: number) {
  const narrow = cssW < 940;
  const marginSide = narrow ? 0.012 : 0.07;
  const bays = cssW >= 1240 ? 3 : cssW >= 700 ? 2 : 1;
  // Sides and uprights, the overhang of the top board, and the margins.
  const walls = (bays + 1) * 0.022 + 0.018 + marginSide * 2;
  const fit = Math.round(((cssW / 950 - walls) / bays) * 1000);
  const cell = bays === 3 ? 400 : clamp(fit, bays === 2 ? 340 : 300, 440);
  return { bays, cell, marginSide };
}

export interface CaseSize {
  bays: number;
  levels: number;
  /** Inner width of one bay. */
  cell: number;
  /** Clear height between two boards. */
  clear: number;
  board: number;
  /** The top board is a little thicker and stands proud of the sides. */
  top: number;
  overhang: number;
  side: number;
  /** The recessed base under the bottom board. */
  plinth: number;
  depth: number;
  /** Outer width over the sides, and height from the floor to the top of the top board. */
  outer: number;
  height: number;
}

export function caseSize(cells: Cell[], cellWidth: number, bays = 1): CaseSize {
  const all = cells.flatMap((c) => c.books.map((p) => p.book));
  const tallest = Math.max(180, ...all.map((b) => b.h));
  const deepest = Math.max(110, ...all.map((b) => b.w));
  const levels = Math.max(1, Math.ceil(cells.length / bays));
  const clear = tallest + 38;
  const board = 30;
  const top = 34;
  const side = 22;
  const plinth = 76;
  return {
    bays,
    levels,
    cell: cellWidth,
    clear,
    board,
    top,
    overhang: 9,
    side,
    plinth,
    depth: deepest + 58,
    outer: bays * cellWidth + (bays + 1) * side,
    height: plinth + levels * (clear + board) + top,
  };
}

/** Height of the top face of the board under a level, measured from the floor. Level 0 is the top one. */
export const shelfTop = (size: CaseSize, level: number) =>
  size.plinth + size.board + (size.levels - 1 - level) * (size.clear + size.board);
