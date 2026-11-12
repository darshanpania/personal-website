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
    // Series line shown above the title, e.g. "Building FPL Guru · Part 1 of 7".
    // A post with a series also shows its description under the title.
    series: z.string().optional(),
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

export const collections = { blog, posts, projects };
