# Books shelf

The page at `/books` draws the books in `src/content/books.json` in a 3D
bookcase that stands on a wood floor. The books are shelved by genre. A click
on a spine pulls the book out and shows its cover.

The case has three bays on a desktop, two on a tablet and one on a phone. It
gets as many shelves as the books need, so it grows when you add books.

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
colours gets a colour from a small palette; books of one series share it. A
paperback without a `spine.layout` gets one of five designs; all the books of
one author or series get the same design, as a publisher does.

## Fields

| Field | Use |
| --- | --- |
| `id` | Unique. Also the name of the cover file. |
| `title`, `author`, `genre` | Required. A new genre name gets its own place in the case and its own label. |
| `series`, `seriesIndex` | Books of a series stand together, in index order. |
| `year`, `pages` | Shown next to the open book. `pages` also sets the spine thickness. |
| `format` | `hardcover`, `paperback` (default) or `mass-market`. Sets the size and the build of the book. |
| `width`, `height` | Trim size in millimetres, for an unusual book. |
| `cover` | Path under `/images/books/`. |
| `note` | A line or two of your own, shown next to the open book. |
| `rating` | Your stars, 1 to 5, shown next to the open book. |
| `spine.layout` | `classic` (rules, title, author at the foot: the default for a hardcover), `plain` (title and author on the bare colour), `band` (author in a coloured band at the head), `block` (a coloured block at the foot) or `label` (the title on a coloured panel). |
| `spine.font` | `serif`, `sans`, `wide`, `condensed` or `display`. |
| `spine.bg`, `spine.fg`, `spine.accent` | Spine colour, title colour, colour of the smaller text. |
| `spine.band`, `spine.bandFg`, `spine.bandText` | Second colour and its text colour (`band`, `block` and `label` layouts); `bandText` is the text in the band. |
| `spine.title`, `spine.subtitle` | Text on the spine when it differs from `title`. |
| `spine.publisher` | Small name at the foot of the spine. |
| `spine.image` | Path under `/images/books/` to a straight-on photo of the real spine. It replaces the typeset spine. |

Genres appear in the order of their first book in the file. A genre starts in
a new compartment unless all of it fits beside the genre before it. A long
genre is shared out evenly over two or more compartments. Each compartment
has a label for each genre in it.

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

The canvas is see-through: the page is the wall. The stage is as wide as the
window, so the floor runs from one side of the page to the other and fades
into the page at the bottom.

## Link preview

`public/og/books.jpg` (1200 x 630) and `public/og/books.mp4` are the image and
the short video that a link to `/books` shows. They are pictures of the real
page, taken with a headless browser at `/books/?shelf=3d&quality=high`. Make
them again when the shelf changes a lot. The video is extra: most apps show
only the image.

Wood textures: "Walnut Veneer" (case) and "Wood Floor" (floor) from Poly Haven (CC0).

## Analytics

PostHog loads from `Base.astro` in production, so `/books` sends page views like every other page. The page script (`src/books/main.ts`) adds two events:

| Event | When | Properties |
| --- | --- | --- |
| `book_opened` | A visitor takes a book out (3D) or opens its dialog (flat). | `book_id`, `title`, `author`, `genre`, `series`, `shelf` (`3d` or `flat`) |
| `books_shelf_shown` | A shelf view comes into use: on page load, and after the switch link. | `shelf` (`3d` or `flat`), `quality` (`high`, `low` or null), `reason` (`auto`, `toggle` or `3d_failed`), `books` (count) |

Nothing is sent when PostHog is not loaded (dev, or a visitor who blocks it).
