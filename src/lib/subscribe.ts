// Pure helpers for the /api/subscribe route. Kept in src/lib so the unit
// tests can import without booting the Astro runtime.

const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

export type SubscribeBody = {
  email: string;
  firstName: string;
  source: "modal" | "inline";
  slug: string;
  website: string;
};

export type ParsedBody =
  | { ok: true; body: SubscribeBody }
  | { ok: false; error: "invalid_email" | "honeypot" };

export function parseBody(raw: unknown): ParsedBody {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_email" };
  const r = raw as Record<string, unknown>;

  const email = typeof r.email === "string" ? r.email.trim() : "";
  if (!isValidEmail(email)) return { ok: false, error: "invalid_email" };

  const website = typeof r.website === "string" ? r.website : "";
  if (website.length > 0) return { ok: false, error: "honeypot" };

  const firstName =
    typeof r.firstName === "string" ? r.firstName.trim().slice(0, 100) : "";

  const source: SubscribeBody["source"] = r.source === "modal" ? "modal" : "inline";
  const slug = typeof r.slug === "string" ? r.slug.slice(0, 200) : "";

  return { ok: true, body: { email, firstName, source, slug, website: "" } };
}

// Best-effort in-memory rate limit. Resets on cold start, which is acceptable
// for a personal site — the limit exists to slow down accidental floods, not
// to provide a hard guarantee.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

type Bucket = { count: number; windowStart: number };

export function createRateLimiter() {
  const buckets = new Map<string, Bucket>();

  return function check(ip: string, now: number = Date.now()): boolean {
    const key = ip || "unknown";
    const existing = buckets.get(key);
    if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (existing.count >= RATE_LIMIT_MAX) return false;
    existing.count += 1;
    return true;
  };
}

export type AutoSendDeps = {
  apiKey: string;
  listId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type AutoSendResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "upstream" };

// Shared POST plumbing. Returns the HTTP status so each caller can decide
// what a 4xx means for it — a rejected address is the reader's problem on
// signup, but a plain failure when promoting an already-validated contact.
type PostResult = { ok: true } | { ok: false; status: number | null };

async function postAutoSend(
  path: string,
  payload: Record<string, unknown>,
  deps: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<PostResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 8000);

  try {
    const res = await fetchImpl(`https://api.autosend.com/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    // Status codes only — never echo the address or upstream body into logs.
    console.error(`[subscribe] AutoSend POST ${path} -> ${res.status}`);
    return { ok: false, status: res.status };
  } catch (err) {
    console.error(`[subscribe] AutoSend POST ${path} failed`, (err as Error).name);
    return { ok: false, status: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function callAutoSend(
  email: string,
  firstName: string,
  deps: AutoSendDeps,
): Promise<AutoSendResult> {
  // Only include firstName when non-empty. AutoSend appears to treat an
  // empty-string firstName as "no value, use placeholder defaults" and
  // stores literal "Jane" / "Smith" on the contact record. We never
  // collect lastName, so it's omitted entirely.
  const payload: Record<string, unknown> = {
    email,
    listIds: [deps.listId],
  };
  if (firstName) payload.firstName = firstName;

  const res = await postAutoSend("/contacts/email", payload, deps);
  if (res.ok) return { ok: true };
  // Only a rejected payload means the reader typed something wrong. 401/403
  // (bad or missing API key) and 429 are our problem, and telling someone
  // their perfectly good address "looks off" sends them chasing a typo that
  // isn't there.
  if (res.status === 400 || res.status === 422) {
    return { ok: false, error: "invalid_email" };
  }
  return { ok: false, error: "upstream" };
}

// --- double opt-in ----------------------------------------------------

export type ConfirmMailDeps = {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  unsubscribeGroupId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function confirmEmailHtml(confirmUrl: string): string {
  // Deliberately plain: table-free, inline styles, one call to action. The
  // href is interpolated raw because it is built server-side from SITE_URL
  // plus a base64url token — no reader-supplied text reaches it.
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18130e;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">One click and you're in.</p>
    <p style="font-size:15px;line-height:1.6;color:#7c736a;margin:0 0 24px;">
      You asked for new posts from darshanpania.me by email. Confirm the address
      so I know it's really you.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block;background:#3d5a80;color:#faf8f5;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;">Confirm subscription</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#7c736a;margin:0 0 8px;">
      The link expires in 48 hours. If you didn't sign up, ignore this — nothing
      happens without that click.
    </p>
  </div>
</body></html>`;
}

export async function sendConfirmationEmail(
  email: string,
  confirmUrl: string,
  deps: ConfirmMailDeps,
): Promise<AutoSendResult> {
  const payload: Record<string, unknown> = {
    to: { email },
    from: { email: deps.fromEmail, name: deps.fromName ?? "Darshan Pania" },
    subject: "Confirm your subscription",
    html: confirmEmailHtml(confirmUrl),
  };
  if (deps.replyTo) payload.replyTo = { email: deps.replyTo };
  // Passing the suppression group means someone who previously unsubscribed
  // does not get re-mailed just because a stranger typed their address in.
  if (deps.unsubscribeGroupId) payload.unsubscribeGroupId = deps.unsubscribeGroupId;

  const res = await postAutoSend("/mails/send", payload, deps);
  return res.ok ? { ok: true } : { ok: false, error: "upstream" };
}

// Moves a verified contact onto the confirmed list. Campaigns target that
// list, so this call is what actually earns someone a newsletter.
export async function confirmSubscriber(
  email: string,
  deps: AutoSendDeps,
): Promise<AutoSendResult> {
  const res = await postAutoSend(
    "/contacts/email",
    { email, listIds: [deps.listId] },
    deps,
  );
  return res.ok ? { ok: true } : { ok: false, error: "upstream" };
}
