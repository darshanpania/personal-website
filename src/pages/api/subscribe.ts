import type { APIRoute } from "astro";
import {
  callAutoSend,
  createRateLimiter,
  parseBody,
  sendConfirmationEmail,
} from "@/lib/subscribe";
import { signConfirmToken } from "@/lib/confirm-token";

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
  const pendingListId = import.meta.env.AUTOSEND_PENDING_LIST_ID;
  const senderEmail = import.meta.env.AUTOSEND_SENDER_EMAIL;
  const confirmSecret = import.meta.env.NEWSLETTER_CONFIRM_SECRET;
  if (!apiKey || !pendingListId || !senderEmail || !confirmSecret) {
    console.error("[subscribe] missing AutoSend or confirmation env config");
    return json(502, { ok: false, error: "upstream" });
  }

  // Land on the pending list only. Nothing reaches the confirmed list — and
  // therefore nothing receives a campaign — until the emailed link is clicked.
  const result = await callAutoSend(parsed.body.email, parsed.body.firstName, {
    apiKey,
    listId: pendingListId,
  });
  if (!result.ok) {
    if (result.error === "invalid_email") {
      return json(400, { ok: false, error: "invalid_email" });
    }
    return json(502, { ok: false, error: "upstream" });
  }

  const siteUrl = import.meta.env.SITE_URL ?? "https://darshanpania.me";
  const token = signConfirmToken(parsed.body.email, confirmSecret);
  const confirmUrl = `${siteUrl}/api/confirm?token=${encodeURIComponent(token)}`;

  const mailed = await sendConfirmationEmail(parsed.body.email, confirmUrl, {
    apiKey,
    fromEmail: senderEmail,
    replyTo: "darshanpania@gmail.com",
    unsubscribeGroupId: import.meta.env.AUTOSEND_UNSUB_GROUP_ID,
  });
  if (!mailed.ok) {
    // The contact is parked on the pending list but has no way to confirm.
    // Report failure so the reader retries rather than waiting on an email
    // that never arrives; the retry is idempotent on AutoSend's side.
    return json(502, { ok: false, error: "upstream" });
  }

  return json(200, { ok: true });
};
