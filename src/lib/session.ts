import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "./db";
import { AppError } from "./errors";

/**
 * Session management (SEC-A05, SEC-A06).
 *
 * Locally the browser receives an opaque 256-bit random token and only its
 * SHA-256 hash is stored in the database, so a database leak does not expose
 * usable tokens. Tokens are delivered in an httpOnly, SameSite cookie (see
 * current-user.ts).
 *
 * On Vercel the filesystem is ephemeral and each function instance may have its
 * own SQLite copy, so a database-backed session row cannot be shared between
 * requests. In that environment we issue a signed, stateless token instead. The
 * signature is HMAC-SHA256 over the user id and expiry, keyed by
 * `SESSION_SECRET` (or a per-deployment secret generated at build time). Any
 * instance can verify it, and the user record itself comes from the bundled
 * demo database, which is identical on every instance.
 */
export const SESSION_COOKIE = "campus_session";

const IDLE_MINUTES = Number.parseInt(
  process.env.SESSION_IDLE_MINUTES ?? "60",
  10,
);
const ABSOLUTE_MINUTES = Number.parseInt(
  process.env.SESSION_ABSOLUTE_MINUTES ?? "480",
  10,
);

const TOKEN_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

function now(): Date {
  return new Date();
}

function idleExpiry(from: Date): Date {
  return new Date(from.getTime() + IDLE_MINUTES * 60_000);
}

function absoluteExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + ABSOLUTE_MINUTES * 60_000);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** True when running inside a Vercel function (not during `next build`). */
function isServerlessRuntime(): boolean {
  return (
    (process.env.VERCEL === "1" || process.env.VERCEL === "true") &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

let cachedSecret: string | null | undefined;

/**
 * Secret used to sign stateless session tokens. `SESSION_SECRET` wins; if it is
 * absent on Vercel, the per-deployment file created by
 * `scripts/prepare-vercel.mjs` is used so the demo works without extra setup.
 */
function sessionSecret(): string | null {
  if (cachedSecret !== undefined) return cachedSecret;

  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= MIN_SECRET_LENGTH) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  if (!isServerlessRuntime()) {
    cachedSecret = null;
    return cachedSecret;
  }

  try {
    const fromFile = readFileSync(
      join(process.cwd(), ".vercel-session-secret"),
      "utf8",
    ).trim();
    cachedSecret =
      fromFile.length >= MIN_SECRET_LENGTH ? fromFile : null;
  } catch {
    cachedSecret = null;
  }
  return cachedSecret;
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/** Create a signed, stateless session token. Exported for tests. */
export function createSignedSessionToken(
  userId: string,
  expiresAt: Date,
  secret: string | null = sessionSecret(),
): string {
  if (!secret) {
    throw new Error("Session signing secret is not configured.");
  }
  const payload = base64url(
    JSON.stringify({
      uid: userId,
      iat: Date.now(),
      exp: expiresAt.getTime(),
    }),
  );
  return `${TOKEN_VERSION}.${payload}.${sign(payload, secret).toString("base64url")}`;
}

/** Verify a signed session token. Exported for tests. */
export function verifySignedSessionToken(
  token: string,
  secret: string | null = sessionSecret(),
): { userId: string; expiresAt: Date } | null {
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

  const [, payload, signature] = parts;
  const expected = sign(payload, secret);
  const actual = Buffer.from(signature, "base64url");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { uid?: unknown; exp?: unknown };
    if (typeof parsed.uid !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (Date.now() >= parsed.exp) return null;
    return { userId: parsed.uid, expiresAt: new Date(parsed.exp) };
  } catch {
    return null;
  }
}

export interface SessionMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Create a session token and (locally) a server-side session row. */
export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<CreatedSession> {
  const createdAt = now();

  if (isServerlessRuntime()) {
    const secret = sessionSecret();
    if (!secret) {
      throw new AppError(
        500,
        "SESSION_CONFIG",
        "Server session signing key is missing. Set SESSION_SECRET in the deployment environment.",
      );
    }
    // Stateless tokens cannot slide their idle window, so use the absolute
    // expiry as the cookie lifetime.
    const expiresAt = absoluteExpiry(createdAt);
    return {
      token: createSignedSessionToken(userId, expiresAt, secret),
      expiresAt,
    };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = idleExpiry(createdAt);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      createdAt,
      expiresAt,
      lastSeenAt: createdAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return { token, expiresAt };
}

export interface ValidatedSession {
  sessionId: string;
  userId: string;
  role: string;
  expiresAt: Date;
}

/**
 * Validate a raw token: checks existence, idle expiry and absolute expiry, and
 * slides the idle window forward. Returns null for any invalid/expired token.
 *
 * On Vercel the token is verified cryptographically instead, because the
 * session row lives on a different (ephemeral) instance.
 */
export async function validateSessionToken(
  token: string,
): Promise<ValidatedSession | null> {
  if (!token) return null;

  if (isServerlessRuntime()) {
    const decoded = verifySignedSessionToken(token);
    if (!decoded) return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return null;

    return {
      sessionId: hashToken(token),
      userId: user.id,
      role: user.role,
      expiresAt: decoded.expiresAt,
    };
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, role: true, isActive: true } } },
  });
  if (!session) return null;

  const current = now();
  const absolute = absoluteExpiry(session.createdAt);
  if (current >= session.expiresAt || current >= absolute) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const slid = new Date(Math.min(idleExpiry(current).getTime(), absolute.getTime()));
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: current, expiresAt: slid },
  });

  return {
    sessionId: session.id,
    userId: session.userId,
    role: session.user.role,
    expiresAt: slid,
  };
}

/**
 * Invalidate one session server-side (logout, SEC-A06).
 *
 * Stateless tokens cannot be revoked server-side; clearing the cookie on the
 * client is the logout mechanism on Vercel.
 */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  if (isServerlessRuntime()) return;
  await prisma.session
    .delete({ where: { tokenHash: hashToken(token) } })
    .catch(() => {});
}

/** Revoke all sessions for a user (used after password reset, SEC-A07). */
export async function destroyAllSessions(userId: string): Promise<void> {
  if (isServerlessRuntime()) return;
  await prisma.session.deleteMany({ where: { userId } });
}
