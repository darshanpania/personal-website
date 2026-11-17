#!/usr/bin/env node
// Fetch the cover of a book and suggest spine colours for it.
//
//   npm run books:cover -- <id> <isbn | image url | local image file>
//
// Writes public/images/books/<id>.webp and prints the lines to paste into
// src/content/books.json. Covers come from Open Library when an ISBN is given.
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [id, source] = process.argv.slice(2);
if (!id || !source) {
  console.error("usage: npm run books:cover -- <id> <isbn | image url | image file>");
  process.exit(1);
}

const isIsbn = /^[0-9Xx-]{10,17}$/.test(source);
const url = isIsbn
  ? `https://covers.openlibrary.org/b/isbn/${source.replace(/-/g, "")}-L.jpg?default=false`
  : source;

let input;
if (/^https?:\/\//.test(url)) {
  const res = await fetch(url, { headers: { "User-Agent": "books-cover-script" } });
  if (!res.ok) {
    console.error(`No cover at ${url} (HTTP ${res.status}). Pass an image URL or file instead.`);
    process.exit(1);
  }
  input = Buffer.from(await res.arrayBuffer());
} else {
  input = await readFile(url);
}

const out = path.join("public", "images", "books", `${id}.webp`);
await mkdir(path.dirname(out), { recursive: true });
const image = sharp(input).resize({ height: 900, withoutEnlargement: false });
const meta = await sharp(input).metadata();
await image.webp({ quality: 80 }).toFile(out);

// Spine colours: the cover's main colour, and a light or dark ink that reads on it.
const { dominant } = await sharp(input).stats();
const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const lum = (0.2126 * dominant.r + 0.7152 * dominant.g + 0.0722 * dominant.b) / 255;
const fg = lum > 0.5 ? "#1c1712" : "#f1e7d0";

if (meta.height < 600) console.warn(`Warning: the source is only ${meta.width}x${meta.height}; the cover will look soft.`);
console.log(`Wrote ${out}\n\nAdd to the book in src/content/books.json:\n`);
console.log(`  "cover": "/images/books/${id}.webp",`);
console.log(`  "spine": { "bg": "${hex(dominant)}", "fg": "${fg}" }`);
