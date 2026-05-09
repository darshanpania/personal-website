// Pure helpers for the /api/subscribe route. Kept in src/lib so the unit
// tests can import without booting the Astro runtime.

const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

export type SubscribeBody = {
  email: string;
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

  const source: SubscribeBody["source"] = r.source === "modal" ? "modal" : "inline";
  const slug = typeof r.slug === "string" ? r.slug.slice(0, 200) : "";

  return { ok: true, body: { email, source, slug, website: "" } };
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

export async function callAutoSend(
  email: string,
  deps: AutoSendDeps,
): Promise<AutoSendResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 8000);

  try {
    const res = await fetchImpl("https://api.autosend.com/v1/contacts/email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, listIds: [deps.listId] }),
      signal: controller.signal,
    });

    if (res.ok) return { ok: true };
    if (res.status >= 400 && res.status < 500) {
      console.warn(`[subscribe] AutoSend rejected with ${res.status}`);
      return { ok: false, error: "invalid_email" };
    }
    console.error(`[subscribe] AutoSend ${res.status}`);
    return { ok: false, error: "upstream" };
  } catch (err) {
    console.error("[subscribe] AutoSend fetch failed", (err as Error).name);
    return { ok: false, error: "upstream" };
  } finally {
    clearTimeout(timer);
  }
}
