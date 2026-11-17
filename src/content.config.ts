import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

// External writing — links to posts published on Substack, Medium, etc.
const blog = defineCollection({
  loader: file("./src/content/blog.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(["tech", "fiction", "non-fiction"]),
    platform: z.string(),
    url: z.string().url(),
    description: z.string().optional(),
  }),
});

// Local MDX posts rendered at /blog/<slug>
const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(["tech", "fiction", "non-fiction"]),
    description: z.string().optional(),
    coverImage: z.string().startsWith("/images/posts/").optional(),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: file("./src/content/projects.json"),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    platform: z.enum(["android", "ios", "web", "github", "other"]),
    description: z.string(),
    link: z.string().url(),
    order: z.number().default(0),
  }),
});

// Books I've read, shown on the 3D shelf at /books. Only title, author and
// genre are required; see docs/books.md for the optional fields.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const books = defineCollection({
  loader: file("./src/content/books.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    author: z.string(),
    genre: z.string(),
    series: z.string().optional(),
    seriesIndex: z.number().optional(),
    year: z.number().int().optional(),
    pages: z.number().int().positive().optional(),
    format: z.enum(["hardcover", "paperback", "mass-market"]).default("paperback"),
    isbn: z.string().optional(),
    cover: z.string().startsWith("/images/books/").optional(),
    // Overrides in millimetres for books with an unusual trim size.
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    note: z.string().optional(),
    spine: z
      .object({
        layout: z.enum(["classic", "band"]).optional(),
        font: z.enum(["serif", "sans", "wide"]).optional(),
        bg: hex.optional(),
        fg: hex.optional(),
        accent: hex.optional(),
        band: hex.optional(),
        bandFg: hex.optional(),
        bandText: z.string().optional(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        publisher: z.string().optional(),
      })
      .default({}),
  }),
});

export const collections = { blog, posts, projects, books };
