import { prisma } from "../db";
import { writeAudit } from "../audit";
import { AppError, UnauthorizedError } from "../errors";
import { normalizeIdentifier, verifyPassword } from "../password";

/** A real bcrypt hash used to equalise timing when an account does not exist. */
const DUMMY_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7q0u0Y0h0m0o0m0o0m0o0m0o0m0o0m0";

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

export interface LoginMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  role: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

async function isRateLimited(
  identifier: string,
  ip: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const failures = await prisma.loginAttempt.count({
    where: {
      success: false,
      createdAt: { gte: since },
      OR: [{ identifier }, ...(ip ? [{ ip }] : [])],
    },
  });
  return failures >= MAX_FAILURES;
}

/**
 * Authenticate by Email / Roll No / ID + password (M01-R08, SEC-A03/04).
 *
 * Always throws the same generic error for a bad identifier or password, and
 * rate-limits repeated failures per identifier and per IP.
 */
export async function authenticate(
  rawIdentifier: string,
  password: string,
  meta: LoginMeta = {},
): Promise<AuthenticatedUser> {
  const identifier = normalizeIdentifier(rawIdentifier);
  const ip = meta.ip ?? null;

  if (await isRateLimited(identifier, ip)) {
    await writeAudit({
      action: "auth.login.locked",
      summary: "Login blocked by rate limiter",
      ip,
      userAgent: meta.userAgent ?? null,
      result: "DENIED",
    });
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many failed attempts. Please wait a few minutes and try again.",
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ loginId: identifier }, { email: identifier }],
    },
  });

  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, DUMMY_HASH).then(() => false);

  if (!user || !ok || !user.isActive) {
    await prisma.loginAttempt.create({
      data: { identifier, ip, success: false },
    });
    await writeAudit({
      actorUserId: user?.id ?? null,
      actorRole: user?.role ?? null,
      action: "auth.login.failed",
      entityType: "User",
      entityId: user?.id ?? null,
      summary: `Failed login for "${identifier}"`,
      ip,
      userAgent: meta.userAgent ?? null,
      result: "FAILURE",
    });
    throw new UnauthorizedError("Invalid credentials.");
  }

  await prisma.loginAttempt.create({ data: { identifier, ip, success: true } });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await writeAudit({
    actorUserId: user.id,
    actorRole: user.role,
    action: "auth.login.success",
    entityType: "User",
    entityId: user.id,
    summary: "Login succeeded",
    ip,
    userAgent: meta.userAgent ?? null,
    result: "SUCCESS",
  });

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    mustChangePassword: user.mustChangePassword,
  };
}
