import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(["tech", "fiction", "non-fiction"]),
    description: z.string().optional(),
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

export const collections = { blog, projects };
