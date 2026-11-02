import { describe, expect, it } from "vitest";
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from "@/lib/session";

/**
 * Regression tests for the serverless session fallback.
 *
 * On Vercel the SQLite session table is per-instance, so the login request and
 * the dashboard request can hit different instances. The session cookie is
 * therefore a stateless, HMAC-signed token. These tests pin its behaviour:
 * valid tokens round-trip, and tampered, wrong-key or expired tokens are
 * rejected.
 */
const SECRET = "test-session-secret-".padEnd(48, "x");

describe("stateless session tokens (Vercel)", () => {
  it("round-trips the user id and expiry", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = createSignedSessionToken("user_123", expiresAt, SECRET);
    const decoded = verifySignedSessionToken(token, SECRET);

    expect(decoded?.userId).toBe("user_123");
    expect(decoded?.expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  it("rejects a tampered payload", () => {
    const token = createSignedSessionToken(
      "user_123",
      new Date(Date.now() + 60_000),
      SECRET,
    );
    const [version, , signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        uid: "attacker",
        iat: Date.now(),
        exp: Date.now() + 60_000,
      }),
    ).toString("base64url");

    expect(
      verifySignedSessionToken(
        `${version}.${tamperedPayload}.${signature}`,
        SECRET,
      ),
    ).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSignedSessionToken(
      "user_123",
      new Date(Date.now() + 60_000),
      SECRET,
    );

    expect(
      verifySignedSessionToken(token, `${SECRET}-different-secret`),
    ).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSignedSessionToken(
      "user_123",
      new Date(Date.now() - 1_000),
      SECRET,
    );

    expect(verifySignedSessionToken(token, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifySignedSessionToken("not-a-token", SECRET)).toBeNull();
    expect(verifySignedSessionToken("v1.abc", SECRET)).toBeNull();
  });
});
