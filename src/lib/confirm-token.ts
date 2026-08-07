// Signed, expiring tokens for double opt-in confirmation links.
//
// The token is `<payload>.<signature>` where payload is base64url JSON
// holding the email and an absolute expiry, and signature is an HMAC-SHA256
// of the payload under NEWSLETTER_CONFIRM_SECRET. Nothing is stored
// server-side — the signature is what makes the link unforgeable, so a
// stranger cannot confirm someone else's address by guessing an id.

import { createHmac, timingSafeEqual } from "node:crypto";

export const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export type VerifyResult =
  | { ok: true; email: string }
  | { ok: false; error: "malformed" | "bad_signature" | "expired" };

type Payload = { e: string; x: number };

const b64urlEncode = (buf: Buffer): string =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function b64urlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function sign(payloadB64: string, secret: string): string {
  return b64urlEncode(createHmac("sha256", secret).update(payloadB64).digest());
}

export function signConfirmToken(
  email: string,
  secret: string,
  now: number = Date.now(),
  ttlMs: number = CONFIRM_TTL_MS,
): string {
  const payload: Payload = { e: email, x: now + ttlMs };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function verifyConfirmToken(
  token: unknown,
  secret: string,
  now: number = Date.now(),
): VerifyResult {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, error: "malformed" };
  }

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, error: "malformed" };

  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(payloadB64, secret);

  // Compare as fixed-width buffers so a length mismatch can't short-circuit
  // before timingSafeEqual gets a chance to run in constant time.
  const provided = Buffer.from(providedSig, "utf8");
  const expected = Buffer.from(expectedSig, "utf8");
  if (provided.length !== expected.length) return { ok: false, error: "bad_signature" };
  if (!timingSafeEqual(provided, expected)) return { ok: false, error: "bad_signature" };

  let payload: Payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as Payload;
  } catch {
    return { ok: false, error: "malformed" };
  }

  if (typeof payload?.e !== "string" || typeof payload?.x !== "number") {
    return { ok: false, error: "malformed" };
  }
  // Signature already proved integrity, so an expiry in the past is a genuine
  // timeout rather than tampering.
  if (now >= payload.x) return { ok: false, error: "expired" };

  return { ok: true, email: payload.e };
}
