import type { APIRoute } from "astro";
import { confirmSubscriber } from "@/lib/subscribe";
import { verifyConfirmToken } from "@/lib/confirm-token";

export const prerender = false;

// GET, because this is opened from a link in an email. That does mean an
// aggressive scanner or link-prefetcher on the reader's side can trip the
// confirmation for them — the accepted trade-off for one-click confirm, and
// the reason the token is single-purpose and expiring rather than a
// long-lived credential.
export const GET: APIRoute = async ({ url, redirect }) => {
  const to = (state: string) => redirect(`/subscribed?state=${state}`, 302);

  const confirmSecret = import.meta.env.NEWSLETTER_CONFIRM_SECRET;
  const apiKey = import.meta.env.AUTOSEND_API_KEY;
  const listId = import.meta.env.AUTOSEND_LIST_ID;
  if (!confirmSecret || !apiKey || !listId) {
    console.error("[confirm] missing AutoSend or confirmation env config");
    return to("error");
  }

  const verified = verifyConfirmToken(url.searchParams.get("token"), confirmSecret);
  if (!verified.ok) {
    // "expired" is recoverable by signing up again; the other two mean the
    // link was mangled or forged. Don't spell out which to the visitor.
    return to(verified.error === "expired" ? "expired" : "invalid");
  }

  const promoted = await confirmSubscriber(verified.email, { apiKey, listId });
  if (!promoted.ok) return to("error");

  return to("confirmed");
};
