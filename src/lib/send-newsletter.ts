// Pure helpers for the /api/send-newsletter route. Same shape as
// src/lib/subscribe.ts so both AutoSend integrations look alike and are
// equally testable without booting Astro.

import { marked } from "marked";

export type SendNewsletterBody = {
  slug: string;
  dryRun: boolean;
};

export type ParsedSendBody =
  | { ok: true; body: SendNewsletterBody }
  | { ok: false; error: "invalid_slug" };

export function parseSendBody(raw: unknown): ParsedSendBody {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_slug" };
  const r = raw as Record<string, unknown>;
  const slug = typeof r.slug === "string" ? r.slug.trim() : "";
  // Slugs come from filenames in src/content/posts; restrict to the same
  // safe character set Astro's content collections use.
  if (!slug || slug.length > 200 || !/^[a-z0-9][a-z0-9-_]*$/i.test(slug)) {
    return { ok: false, error: "invalid_slug" };
  }
  const dryRun = r.dryRun === true;
  return { ok: true, body: { slug, dryRun } };
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function markdownToHtml(body: string): string {
  // Posts are author-controlled (only Darshan writes them), so we trust
  // the markdown source and skip sanitization. `marked` is sync when
  // called without `async: true`.
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(body, { async: false }) as string;
}

export type CampaignDeps = {
  apiKey: string;
  listId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type CampaignInput = {
  name: string;
  subject: string;
  html: string;
};

export type CampaignResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "upstream" };

export async function callAutoSendCampaign(
  input: CampaignInput,
  deps: CampaignDeps,
): Promise<CampaignResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 15_000);

  try {
    const res = await fetchImpl("https://api.autosend.com/v1/campaigns", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        subject: input.subject,
        htmlTemplate: input.html,
        toLists: [deps.listId],
        sendMode: "immediate",
      }),
      signal: controller.signal,
    });

    if (res.ok) return { ok: true };
    if (res.status >= 400 && res.status < 500) {
      console.warn(`[send-newsletter] AutoSend rejected with ${res.status}`);
      return { ok: false, error: "invalid" };
    }
    console.error(`[send-newsletter] AutoSend ${res.status}`);
    return { ok: false, error: "upstream" };
  } catch (err) {
    console.error("[send-newsletter] AutoSend fetch failed", (err as Error).name);
    return { ok: false, error: "upstream" };
  } finally {
    clearTimeout(timer);
  }
}
