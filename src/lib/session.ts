import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";

/**
 * Session management (SEC-A05, SEC-A06).
 *
 * The browser receives an opaque 256-bit random token. Only its SHA-256 hash is
 * stored server-side, so a database leak does not expose usable tokens. Tokens
 * are delivered in an httpOnly, SameSite cookie (see current-user.ts).
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

export interface SessionMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Create a server-side session row and return the raw token for the cookie. */
export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const createdAt = now();
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
 */
export async function validateSessionToken(
  token: string,
): Promise<ValidatedSession | null> {
  if (!token) return null;
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

/** Invalidate one session server-side (logout, SEC-A06). */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await prisma.session
    .delete({ where: { tokenHash: hashToken(token) } })
    .catch(() => {});
}

/** Revoke all sessions for a user (used after password reset, SEC-A07). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
