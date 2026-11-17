# Books shelf

The page at `/books` draws the books in `src/content/books.json` on a 3D shelf.
Each genre gets its own shelves. A click on a spine pulls the book out and
shows its cover.

## Add a book

1. Add an entry to `src/content/books.json`. Only four fields are required:

   ```json
   {
     "id": "dune",
     "title": "Dune",
     "author": "Frank Herbert",
     "genre": "Science Fiction"
   }
   ```

2. Fetch the cover (optional, but the shelf looks best with it):

   ```sh
   npm run books:cover -- dune 9780441172719
   ```

   The script saves `public/images/books/dune.webp` and prints the `cover` and
   `spine` lines to paste into the entry. In place of the ISBN you can give an
   image URL or a local image file.

A book without a cover gets a plain typographic cover. A book without spine
colours gets a colour from a small palette; books of one series share it.

## Fields

| Field | Use |
| --- | --- |
| `id` | Unique. Also the name of the cover file. |
| `title`, `author`, `genre` | Required. A new genre name makes a new shelf with its own brass label. |
| `series`, `seriesIndex` | Books of a series stand together, in index order. |
| `year`, `pages` | Shown next to the open book. `pages` also sets the spine thickness. |
| `format` | `hardcover`, `paperback` (default) or `mass-market`. Sets the size and the build of the book. |
| `width`, `height` | Trim size in millimetres, for an unusual book. |
| `cover` | Path under `/images/books/`. |
| `note` | A line or two of your own, shown next to the open book. |
| `spine.layout` | `classic` (title down the spine, author at the foot) or `band` (author in a coloured band at the head). |
| `spine.font` | `serif`, `sans` or `wide`. |
| `spine.bg`, `spine.fg`, `spine.accent` | Spine colour, title colour, colour of the smaller text. |
| `spine.band`, `spine.bandFg`, `spine.bandText` | Colours and text of the band (`band` layout). |
| `spine.title`, `spine.subtitle` | Text on the spine when it differs from `title`. |
| `spine.publisher` | Small name at the foot of the spine. |

Genres appear in the order of their first book in the file.

## How it is built

- `src/books/layout.ts`: sizes, order and shelf packing. No browser code; covered by `tests/books/`.
- `src/books/spine.ts`: draws spines, plain covers and labels on canvases.
- `src/books/scene.ts`: the three.js scene. Loaded only on `/books`.
- `src/books/mode.ts`: picks the 3D shelf or the flat one.
- `src/pages/books.astro`: the page. It renders a flat CSS shelf first; the
  script swaps in the 3D shelf when the device can draw it.

The flat shelf is used when there is no WebGL 2, when the visitor asks for
reduced motion or data saving, and on devices with little memory. The link
under the shelf switches between the two; `?shelf=3d` or `?shelf=flat` forces one.

Wood textures: "Walnut Veneer" from Poly Haven (CC0).
