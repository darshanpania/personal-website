import { describe, expect, it } from "vitest";
import {
  casePlan,
  caseSize,
  groupByGenre,
  packCells,
  resolveBook,
  SHELF,
  shelfTop,
  thickness,
  type BookInput,
} from "../../src/books/layout";
import { decideMode, decideQuality, type DeviceFacts } from "../../src/books/mode";
import { existsSync } from "node:fs";
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

describe("packCells", () => {
  const genres = groupByGenre((books as BookInput[]).map(resolveBook));
  const count = (books as BookInput[]).length;
  // Twelve books of 20 mm are 240 mm of shelf; three of them are 60 mm.
  const run = (genre: string, n: number) =>
    Array.from({ length: n }, (_, i) => resolveBook(book({ id: `${genre}-${i}`, genre, pages: 310 })));

  it("places every book once, whatever the size of the case", () => {
    for (const [width, bays] of [[300, 1], [340, 2], [400, 3], [440, 2]] as const) {
      const cells = packCells(genres, width, bays);
      expect(cells.flatMap((c) => c.books).length).toBe(count);
      expect(cells.length % bays).toBe(0);
    }
  });

  it("labels every cell that holds books with the genres in it", () => {
    for (const cell of packCells(genres, 400, 3)) {
      const inCell = [...new Set(cell.books.map((p) => p.book.genre))];
      expect(cell.labels.map((l) => l.genre)).toEqual(inCell);
      for (const l of cell.labels) expect(l.x + SHELF.label).toBeLessThanOrEqual(400 - SHELF.padRight);
    }
  });

  it("puts a short genre in the cell of the genre before it, with a plate between", () => {
    const cells = packCells(groupByGenre([...run("A", 6), ...run("B", 3)]), 400);
    expect(cells.length).toBe(1);
    expect(cells[0].labels.map((l) => l.genre)).toEqual(["A", "B"]);
    expect(cells[0].plates.length).toBeGreaterThanOrEqual(1);
    const firstB = cells[0].books.find((p) => p.book.genre === "B")!;
    expect(cells[0].plates[0]).toBeLessThan(firstB.x);
  });

  it("shares a long genre out evenly and starts the next genre in a new cell", () => {
    const cells = packCells(groupByGenre([...run("A", 30), ...run("B", 12)]), 400);
    const a = cells.filter((c) => c.labels[0]?.genre === "A");
    expect(a.length).toBe(2);
    expect(Math.abs(a[0].books.length - a[1].books.length)).toBeLessThanOrEqual(1);
    expect(cells[a.length].labels[0].genre).toBe("B");
  });

  it("leaves no cell of the case empty", () => {
    const cells = packCells(groupByGenre([...run("A", 30), ...run("B", 12), ...run("C", 12), ...run("D", 12)]), 400, 3);
    expect(cells.length).toBe(6);
    expect(cells.every((c) => c.books.length > 0)).toBe(true);
  });

  it("never lets books overlap or pass the right wall", () => {
    for (const [width, bays] of [[300, 1], [340, 2], [400, 3], [440, 2]] as const) {
      for (const cell of packCells(genres, width, bays)) {
        cell.books.forEach((p, i) => {
          if (i) {
            const prev = cell.books[i - 1];
            expect(p.x).toBeGreaterThanOrEqual(prev.x + prev.book.t);
          }
          // A leaning book reaches further to the right than its thickness.
          const reach = p.book.t * Math.cos(p.lean) + p.book.h * Math.sin(p.lean);
          expect(p.x - p.book.h * Math.sin(p.lean) + reach).toBeLessThanOrEqual(width - SHELF.padRight + 0.001);
        });
        expect(cell.end).toBeLessThanOrEqual(width - SHELF.padRight);
        for (const p of cell.books.slice(0, -1)) expect(p.lean).toBe(0);
      }
    }
  });

  it("sizes the case to the tallest and deepest book and stands it on a plinth", () => {
    const cells = packCells(genres, 400, 3);
    const size = caseSize(cells, 400, 3);
    expect(size.levels).toBe(cells.length / 3);
    expect(size.clear).toBeGreaterThan(204);
    expect(size.depth).toBeGreaterThan(135);
    expect(size.outer).toBe(3 * 400 + 4 * size.side);
    expect(size.height).toBe(size.plinth + size.levels * (size.clear + size.board) + size.top);
    // The bottom shelf is one board above the plinth; the top shelf is the highest.
    expect(shelfTop(size, size.levels - 1)).toBe(size.plinth + size.board);
    expect(shelfTop(size, 0) + size.clear + size.top).toBe(size.height);
  });
});

describe("casePlan", () => {
  it("gives a phone one bay, a tablet two and a desktop three", () => {
    expect(casePlan(390).bays).toBe(1);
    expect(casePlan(820).bays).toBe(2);
    expect(casePlan(1440)).toMatchObject({ bays: 3, cell: 400 });
  });

  it("keeps a bay between 300 and 440 mm wide", () => {
    for (let w = 320; w <= 2000; w += 20) {
      const { cell } = casePlan(w);
      expect(cell).toBeGreaterThanOrEqual(300);
      expect(cell).toBeLessThanOrEqual(440);
    }
  });

  it("fits the case in the stage at a readable size", () => {
    for (const w of [360, 390, 700, 940, 1240, 1680]) {
      const { bays, cell, marginSide } = casePlan(w);
      const metres = (bays * cell + (bays + 1) * 22 + 18) / 1000 + marginSide * 2;
      // CSS pixels for each millimetre of shelf.
      expect(w / metres / 1000).toBeGreaterThan(0.8);
    }
  });
});

describe("books.json", () => {
  const list = books as BookInput[];

  it("has unique ids", () => {
    const ids = list.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names only cover files that are in the repository", () => {
    for (const b of list) {
      if (!b.cover) continue;
      expect(b.cover).toMatch(/^\/images\/books\/.+\.webp$/);
      expect(existsSync(`public${b.cover}`), b.cover).toBe(true);
    }
  });

  it("keeps each genre in one run and each series in order", () => {
    const genres = groupByGenre(list.map(resolveBook));
    expect(genres.length).toBe(new Set(list.map((b) => b.genre)).size);
    for (const g of genres) {
      const seen = new Map<string, number>();
      for (const b of g.books) {
        if (!b.series || b.seriesIndex === undefined) continue;
        expect(b.seriesIndex).toBeGreaterThanOrEqual(seen.get(b.series) ?? -Infinity);
        seen.set(b.series, b.seriesIndex);
      }
    }
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
