import type { APIRoute } from "astro";
import { callAutoSend, createRateLimiter, parseBody } from "@/lib/subscribe";

export const prerender = false;

const limiter = createRateLimiter();

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, error: "invalid_email" });
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    if (parsed.error === "honeypot") {
      // Pretend success so bots don't tune their payloads.
      return json(200, { ok: true });
    }
    return json(400, { ok: false, error: parsed.error });
  }

  const ip = clientAddress ?? request.headers.get("x-forwarded-for") ?? "unknown";
  if (!limiter(ip)) {
    return json(429, { ok: false, error: "rate_limited" });
  }

  const apiKey = import.meta.env.AUTOSEND_API_KEY;
  const listId = import.meta.env.AUTOSEND_LIST_ID;
  if (!apiKey || !listId) {
    console.error("[subscribe] AUTOSEND_API_KEY or AUTOSEND_LIST_ID not set");
    return json(502, { ok: false, error: "upstream" });
  }

  const result = await callAutoSend(parsed.body.email, parsed.body.firstName, {
    apiKey,
    listId,
  });
  if (result.ok) return json(200, { ok: true });
  if (result.error === "invalid_email") {
    return json(400, { ok: false, error: "invalid_email" });
  }
  return json(502, { ok: false, error: "upstream" });
};
