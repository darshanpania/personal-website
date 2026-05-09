import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { renderPostEmail } from "@/lib/email-template";
import {
  callAutoSendCampaign,
  constantTimeEquals,
  markdownToHtml,
  parseSendBody,
} from "@/lib/send-newsletter";

export const prerender = false;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, site }) => {
  const expectedSecret = import.meta.env.SEND_NEWSLETTER_SECRET;
  if (!expectedSecret) {
    console.error("[send-newsletter] SEND_NEWSLETTER_SECRET not configured");
    return json(502, { ok: false, error: "not_configured" });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !constantTimeEquals(token, expectedSecret)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, error: "invalid_slug" });
  }

  const parsed = parseSendBody(raw);
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });

  const posts = await getCollection("posts", ({ data }) => !data.draft);
  const post = posts.find((p) => p.id === parsed.body.slug);
  if (!post) return json(404, { ok: false, error: "post_not_found" });

  const apiKey = import.meta.env.AUTOSEND_API_KEY;
  const listId = parsed.body.dryRun
    ? import.meta.env.AUTOSEND_DRY_RUN_LIST_ID
    : import.meta.env.AUTOSEND_LIST_ID;
  if (!apiKey || !listId) {
    console.error(
      `[send-newsletter] Missing AUTOSEND_API_KEY or list ID (dryRun=${parsed.body.dryRun})`,
    );
    return json(502, { ok: false, error: "not_configured" });
  }

  const bodyHtml = markdownToHtml(post.body ?? "");
  const html = renderPostEmail({
    title: post.data.title,
    date: post.data.date,
    slug: post.id,
    bodyHtml,
    coverImage: post.data.coverImage,
    siteUrl: site?.href,
  });

  const namePrefix = parsed.body.dryRun ? "blog (dry-run): " : "blog: ";
  const result = await callAutoSendCampaign(
    {
      name: `${namePrefix}${post.id}`,
      subject: post.data.title,
      html,
    },
    { apiKey, listId },
  );

  if (result.ok) {
    return json(200, {
      ok: true,
      slug: post.id,
      dryRun: parsed.body.dryRun,
      listId,
    });
  }
  if (result.error === "invalid") {
    return json(400, { ok: false, error: "invalid" });
  }
  return json(502, { ok: false, error: "upstream" });
};
