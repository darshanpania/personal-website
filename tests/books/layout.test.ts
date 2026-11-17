import { describe, expect, it } from "vitest";
import {
  caseSize,
  groupByGenre,
  packShelves,
  resolveBook,
  SHELF,
  thickness,
  type BookInput,
} from "../../src/books/layout";
import { decideMode, decideQuality, type DeviceFacts } from "../../src/books/mode";
import books from "../../src/content/books.json";

const book = (over: Partial<BookInput> & { id: string }): BookInput => ({
  title: over.id,
  author: "Ann Author",
  genre: "Fiction",
  ...over,
});

describe("resolveBook", () => {
  it("needs only title, author and genre", () => {
    const b = resolveBook(book({ id: "plain" }));
    expect(b.format).toBe("paperback");
    expect(b.w).toBe(129);
    expect(b.h).toBe(198);
    expect(b.spine.bg).toMatch(/^#[0-9a-f]{6}$/);
    expect(b.spine.bandText).toBe("Author");
    expect(b.spine.title).toBe("plain");
  });

  it("gives the books of one series the same default colour", () => {
    const a = resolveBook(book({ id: "a", series: "Saga" }));
    const b = resolveBook(book({ id: "b", series: "Saga" }));
    expect(a.spine.bg).toBe(b.spine.bg);
  });

  it("makes a longer book thicker, within sane limits", () => {
    expect(thickness(700, "hardcover")).toBeGreaterThan(thickness(200, "hardcover"));
    expect(thickness(5, "paperback")).toBe(8);
    expect(thickness(9000, "hardcover")).toBe(80);
  });
});

describe("groupByGenre", () => {
  it("keeps genres in file order and sorts a series by its index", () => {
    const genres = groupByGenre(
      [
        book({ id: "s2", series: "S", seriesIndex: 2 }),
        book({ id: "alone" }),
        book({ id: "other", genre: "History" }),
        book({ id: "s1", series: "S", seriesIndex: 1 }),
      ].map(resolveBook),
    );
    expect(genres.map((g) => g.name)).toEqual(["Fiction", "History"]);
    expect(genres[0].books.map((b) => b.id)).toEqual(["s1", "s2", "alone"]);
  });
});

describe("packShelves", () => {
  const genres = groupByGenre((books as BookInput[]).map(resolveBook));

  it("starts every genre on a new shelf and labels only its first shelf", () => {
    const rows = packShelves(genres, 500);
    expect(rows.map((r) => r.genre)).toEqual(["Fantasy", "Science Fiction"]);
    expect(rows.every((r) => r.first)).toBe(true);
  });

  it("wraps a genre onto more shelves when the case is narrow", () => {
    const rows = packShelves(genres, 160);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.filter((r) => r.first).map((r) => r.genre)).toEqual(["Fantasy", "Science Fiction"]);
    expect(rows.flatMap((r) => r.books).length).toBe(books.length);
  });

  it("never lets books overlap or pass the right wall", () => {
    for (const width of [160, 300, 520]) {
      for (const row of packShelves(genres, width)) {
        row.books.forEach((p, i) => {
          if (i) {
            const prev = row.books[i - 1];
            expect(p.x).toBeGreaterThanOrEqual(prev.x + prev.book.t);
          }
        });
        if (row.books.length > 1) expect(row.end).toBeLessThanOrEqual(width - SHELF.padRight);
      }
    }
  });

  it("sizes the case to the tallest and deepest book", () => {
    const rows = packShelves(genres, 500);
    const size = caseSize(rows, 500);
    expect(size.clear).toBeGreaterThan(204);
    expect(size.depth).toBeGreaterThan(135);
    expect(size.height).toBe(rows.length * size.clear + (rows.length + 1) * size.board);
  });
});

describe("books.json", () => {
  it("has unique ids and a cover file path for every book", () => {
    const ids = (books as BookInput[]).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of books as BookInput[]) expect(b.cover).toMatch(/^\/images\/books\/.+\.webp$/);
  });
});

describe("decideMode", () => {
  const good: DeviceFacts = {
    choice: null,
    webgl2: true,
    renderer: "ANGLE (Apple, Apple M2, OpenGL 4.1)",
    reducedMotion: false,
    saveData: false,
    memoryGb: 8,
    cores: 8,
    coarsePointer: false,
    screenWidth: 1440,
  };

  it("uses 3D on a capable device", () => {
    expect(decideMode(good)).toBe("3d");
    expect(decideQuality(good)).toBe("high");
  });

  it("falls back to the flat shelf on weak or careful devices", () => {
    expect(decideMode({ ...good, webgl2: false })).toBe("flat");
    expect(decideMode({ ...good, reducedMotion: true })).toBe("flat");
    expect(decideMode({ ...good, saveData: true })).toBe("flat");
    expect(decideMode({ ...good, memoryGb: 2 })).toBe("flat");
    expect(decideMode({ ...good, cores: 2 })).toBe("flat");
    expect(decideMode({ ...good, renderer: "Google SwiftShader" })).toBe("flat");
  });

  it("lets the visitor's choice win, but never without WebGL", () => {
    expect(decideMode({ ...good, reducedMotion: true, choice: "3d" })).toBe("3d");
    expect(decideMode({ ...good, choice: "flat" })).toBe("flat");
    expect(decideMode({ ...good, webgl2: false, choice: "3d" })).toBe("flat");
  });

  it("gives phones the lighter 3D quality", () => {
    expect(decideQuality({ ...good, coarsePointer: true, screenWidth: 390 })).toBe("low");
  });
});
