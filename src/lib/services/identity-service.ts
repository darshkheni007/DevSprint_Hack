import { randomBytes } from "node:crypto";
import { prisma } from "../db";
import { writeAudit } from "../audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { Actor, authorize } from "../permissions";
import { hashPassword, normalizeIdentifier, validatePasswordPolicy, verifyPassword } from "../password";
import { destroyAllSessions } from "../session";
import type { UserCreateInput } from "../validation";

/** Generate a one-time password for an admin-created account (SEC-A08). */
function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out}#7`;
}

export async function listUsers(actor: Actor) {
  authorize(actor, "user:list");
  return prisma.user.findMany({
    include: { studentProfile: { include: { batch: true } }, facultyProfile: true },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  });
}

/**
 * Admin creates an account (M02-R01/R02, Q10: admin-created only).
 * Returns the one-time password exactly once; it is never logged or stored.
 */
export async function createUser(actor: Actor, input: UserCreateInput) {
  authorize(actor, "user:create");

  const email = normalizeIdentifier(input.email);
  const loginId = normalizeIdentifier(input.loginId);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { loginId }] },
    select: { email: true, loginId: true },
  });
  if (existing) {
    throw new ConflictError(
      existing.email === email
        ? "An account with this email already exists."
        : "An account with this login ID already exists.",
    );
  }

  if (input.role === "STUDENT" && (!input.departmentId || !input.batchId)) {
    throw new ValidationError("Students need a department and a batch.");
  }
  if (input.role === "FACULTY" && !input.departmentId) {
    throw new ValidationError("Faculty need a department.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await prisma.user.create({
    data: {
      email,
      loginId,
      passwordHash,
      role: input.role,
      firstName: input.firstName,
      lastName: input.lastName,
      mustChangePassword: true,
    },
  });

  if (input.role === "STUDENT") {
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        rollNo: loginId.toUpperCase(),
        departmentId: input.departmentId!,
        batchId: input.batchId!,
        admissionYear: input.admissionYear ?? new Date().getFullYear(),
      },
    });
  } else if (input.role === "FACULTY") {
    await prisma.facultyProfile.create({
      data: {
        userId: user.id,
        employeeNo: loginId.toUpperCase(),
        departmentId: input.departmentId!,
        designation: input.designation ?? "Assistant Professor",
      },
    });
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    summary: `Created ${input.role} ${email}`,
  });

  return { id: user.id, temporaryPassword };
}

/** Admin activates/deactivates an account. */
export async function setUserActive(
  actor: Actor,
  userId: string,
  isActive: boolean,
) {
  authorize(actor, "user:deactivate");
  if (actor.id === userId) {
    throw new ForbiddenError("You cannot deactivate your own account.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found.");

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  if (!isActive) await destroyAllSessions(userId);

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "user.deactivate",
    entityType: "User",
    entityId: userId,
    summary: isActive ? "Account activated" : "Account deactivated",
  });
}

/** The signed-in user's own profile (own record only; SEC-Z01/Z02). */
export async function getOwnProfile(actor: Actor) {
  authorize(actor, "profile:read");
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    include: {
      studentProfile: {
        include: { department: true, batch: { include: { course: true } } },
      },
      facultyProfile: { include: { department: true } },
    },
  });
  if (!user) throw new NotFoundError("User not found.");
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    loginId: user.loginId,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    student: user.studentProfile
      ? {
          rollNo: user.studentProfile.rollNo,
          department: user.studentProfile.department.name,
          batch: user.studentProfile.batch?.name ?? null,
          course: user.studentProfile.batch?.course.name ?? null,
          admissionYear: user.studentProfile.admissionYear,
        }
      : null,
    faculty: user.facultyProfile
      ? {
          employeeNo: user.facultyProfile.employeeNo,
          department: user.facultyProfile.department.name,
          designation: user.facultyProfile.designation,
        }
      : null,
  };
}

/** Change own password; revokes all other sessions (SEC-A07). */
export async function changeOwnPassword(
  actor: Actor,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new NotFoundError("User not found.");

  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    await writeAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "auth.password.change",
      entityType: "User",
      entityId: actor.id,
      result: "FAILURE",
      summary: "Incorrect current password",
    });
    throw new ValidationError("Your current password is incorrect.", {
      currentPassword: ["Incorrect password."],
    });
  }
  const policyError = validatePasswordPolicy(input.newPassword);
  if (policyError) {
    throw new ValidationError(policyError, { newPassword: [policyError] });
  }

  await prisma.user.update({
    where: { id: actor.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      mustChangePassword: false,
    },
  });
  await destroyAllSessions(actor.id);
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "auth.password.change",
    entityType: "User",
    entityId: actor.id,
    summary: "Password changed; sessions revoked",
  });
}
