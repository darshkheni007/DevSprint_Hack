import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { Role } from "./constants";
import { UnauthorizedError } from "./errors";
import type { Actor } from "./permissions";
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  validateSessionToken,
} from "./session";

/** Build the request-scoped Actor from the session cookie, or null. */
export async function getCurrentActor(): Promise<Actor | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const validated = await validateSessionToken(token);
  if (!validated) return null;

  const user = await prisma.user.findUnique({
    where: { id: validated.userId },
    include: { studentProfile: true, facultyProfile: true },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    role: user.role as Role,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    studentProfileId: user.studentProfile?.id ?? null,
    facultyProfileId: user.facultyProfile?.id ?? null,
    batchId: user.studentProfile?.batchId ?? null,
  };
}

export async function requireCurrentActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new UnauthorizedError();
  return actor;
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]!.trim() : h.get("x-real-ip");
  return { ip: ip ?? null, userAgent: h.get("user-agent") };
}

export async function startSession(
  userId: string,
): Promise<void> {
  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(userId, meta);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
