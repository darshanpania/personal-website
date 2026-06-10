import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const externals = await getCollection("blog");
  const locals = await getCollection("posts", ({ data }) => !data.draft);

  const site = context.site ?? new URL("https://darshanpania.me");

  const items = [
    ...externals.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.description,
      link: p.data.url,
    })),
    ...locals.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.description,
      link: new URL(`/blog/${p.id}`, site).href,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: "Darshan Pania — writing",
    description:
      "Essays on engineering leadership, AI workflows, mobile development, and the occasional sci-fi story.",
    site,
    items,
    customData: "<language>en-us</language>",
  });
}
