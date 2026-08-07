import type { APIRoute } from "astro";
import { confirmSubscriber } from "@/lib/subscribe";
import { verifyConfirmToken } from "@/lib/confirm-token";

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// POST only, on purpose. The emailed link points at /confirm, which verifies
// the token and renders a button; this route is what that button submits.
// Keeping the state change off GET means a mail scanner or link prefetcher
// cannot subscribe somebody who never opened the email.
//
// The body is JSON rather than a form encoding. Astro's built-in origin check
// (security.checkOrigin, on by default) rejects cross-origin POSTs whose
// content type is form-like, comparing the Origin header against the origin
// Astro derives from the request. Behind the Cloudflare -> Vercel proxy those
// two never agree, so a form-encoded submission is refused with a 403 no
// matter which Origin the browser sends. JSON is not a form-like type, so the
// check passes it through — the same reason /api/subscribe has worked since
// it shipped.
export const POST: APIRoute = async ({ request }) => {
  const confirmSecret = import.meta.env.NEWSLETTER_CONFIRM_SECRET;
  const apiKey = import.meta.env.AUTOSEND_API_KEY;
  const listId = import.meta.env.AUTOSEND_LIST_ID;
  if (!confirmSecret || !apiKey || !listId) {
    console.error("[confirm] missing AutoSend or confirmation env config");
    return json({ state: "error" }, 500);
  }

  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown })?.token;
  } catch {
    return json({ state: "invalid" }, 400);
  }

  // Re-verified here rather than trusted from the page that rendered the
  // button — this route is reachable directly.
  const verified = verifyConfirmToken(token, confirmSecret);
  if (!verified.ok) {
    // "expired" is recoverable by signing up again; the other two mean the
    // link was mangled or forged. Don't spell out which to the visitor.
    return json({ state: verified.error === "expired" ? "expired" : "invalid" }, 400);
  }

  const promoted = await confirmSubscriber(verified.email, {
    apiKey,
    listId,
    pendingListId: import.meta.env.AUTOSEND_PENDING_LIST_ID,
  });
  if (!promoted.ok) return json({ state: "error" }, 502);

  return json({ state: "confirmed" });
};
