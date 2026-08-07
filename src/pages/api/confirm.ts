import type { APIRoute } from "astro";
import { confirmSubscriber } from "@/lib/subscribe";
import { verifyConfirmToken } from "@/lib/confirm-token";

export const prerender = false;

// POST only, on purpose. The emailed link points at /confirm, which verifies
// the token and renders a button; this route is what that button submits.
// Keeping the state change off GET means a mail scanner or link prefetcher
// cannot subscribe somebody who never opened the email — the one thing double
// opt-in is supposed to prevent.
export const POST: APIRoute = async ({ request, redirect }) => {
  const to = (state: string) => redirect(`/subscribed?state=${state}`, 302);

  const confirmSecret = import.meta.env.NEWSLETTER_CONFIRM_SECRET;
  const apiKey = import.meta.env.AUTOSEND_API_KEY;
  const listId = import.meta.env.AUTOSEND_LIST_ID;
  if (!confirmSecret || !apiKey || !listId) {
    console.error("[confirm] missing AutoSend or confirmation env config");
    return to("error");
  }

  let token: unknown;
  try {
    token = (await request.formData()).get("token");
  } catch {
    return to("invalid");
  }

  // Re-verified here rather than trusted from the page that rendered the
  // form — this route is reachable directly.
  const verified = verifyConfirmToken(token, confirmSecret);
  if (!verified.ok) {
    // "expired" is recoverable by signing up again; the other two mean the
    // link was mangled or forged. Don't spell out which to the visitor.
    return to(verified.error === "expired" ? "expired" : "invalid");
  }

  const promoted = await confirmSubscriber(verified.email, {
    apiKey,
    listId,
    pendingListId: import.meta.env.AUTOSEND_PENDING_LIST_ID,
  });
  if (!promoted.ok) return to("error");

  return to("confirmed");
};
