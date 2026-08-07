import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CONFIRM_TTL_MS,
  signConfirmToken,
  verifyConfirmToken,
} from "../../src/lib/confirm-token";

const SECRET = "test-secret-do-not-use-in-prod";
const NOW = 1_800_000_000_000;

describe("signConfirmToken / verifyConfirmToken", () => {
  it("round-trips an email", () => {
    const token = signConfirmToken("reader@example.com", SECRET, NOW);
    expect(verifyConfirmToken(token, SECRET, NOW + 1000)).toEqual({
      ok: true,
      email: "reader@example.com",
    });
  });

  it("produces a URL-safe token (no +, /, or = padding)", () => {
    // 40 emails of varying length so the base64 encoder hits every padding case.
    for (let i = 0; i < 40; i++) {
      const token = signConfirmToken(`${"a".repeat(i)}@example.com`, SECRET, NOW);
      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(token).toBe(encodeURIComponent(token));
    }
  });

  it("rejects a token signed with a different secret", () => {
    const token = signConfirmToken("reader@example.com", "other-secret", NOW);
    expect(verifyConfirmToken(token, SECRET, NOW)).toEqual({
      ok: false,
      error: "bad_signature",
    });
  });

  it("rejects a tampered payload — the whole point of signing", () => {
    const token = signConfirmToken("reader@example.com", SECRET, NOW);
    const [, sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ e: "attacker@evil.com", x: NOW + CONFIRM_TTL_MS }),
      "utf8",
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(verifyConfirmToken(`${forgedPayload}.${sig}`, SECRET, NOW)).toEqual({
      ok: false,
      error: "bad_signature",
    });
  });

  it("rejects an expired token at and after the boundary", () => {
    const token = signConfirmToken("reader@example.com", SECRET, NOW);
    const expiry = NOW + CONFIRM_TTL_MS;

    expect(verifyConfirmToken(token, SECRET, expiry - 1).ok).toBe(true);
    expect(verifyConfirmToken(token, SECRET, expiry)).toEqual({
      ok: false,
      error: "expired",
    });
    expect(verifyConfirmToken(token, SECRET, expiry + 1)).toEqual({
      ok: false,
      error: "expired",
    });
  });

  it("honours a custom ttl", () => {
    const token = signConfirmToken("reader@example.com", SECRET, NOW, 60_000);
    expect(verifyConfirmToken(token, SECRET, NOW + 59_999).ok).toBe(true);
    expect(verifyConfirmToken(token, SECRET, NOW + 60_000).ok).toBe(false);
  });

  it("rejects malformed input", () => {
    for (const bad of [null, undefined, 42, "", "nodot", ".", "abc.", ".abc"]) {
      expect(verifyConfirmToken(bad, SECRET, NOW).ok).toBe(false);
    }
  });

  it("rejects an absurdly long token without doing the work", () => {
    expect(verifyConfirmToken("x".repeat(5000), SECRET, NOW)).toEqual({
      ok: false,
      error: "malformed",
    });
  });

  it("rejects a valid signature over a payload missing fields", () => {
    // Signed correctly, but the JSON has no email — must not yield ok.
    const payloadB64 = Buffer.from(JSON.stringify({ x: NOW + 1000 }), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const sig = createHmac("sha256", SECRET)
      .update(payloadB64)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(verifyConfirmToken(`${payloadB64}.${sig}`, SECRET, NOW)).toEqual({
      ok: false,
      error: "malformed",
    });
  });
});
