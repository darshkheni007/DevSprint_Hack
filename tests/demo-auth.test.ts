import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/db";
import { authenticate } from "@/lib/services/auth-service";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedRollToLoginId } from "@/lib/demo-accounts";
import { UnauthorizedError } from "@/lib/errors";

/**
 * Regression tests for the Vercel deployment/auth fix.
 *
 * These tests seed the isolated test database with the exact same demo data
 * that `npm run vercel-build` creates, then verify:
 *   1. The demo accounts from `prisma/seed.ts` can authenticate successfully.
 *   2. The login identifiers stored by the seed match `DEMO_ACCOUNTS`.
 */

async function seedDemoDatabase(): Promise<void> {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const tsxCli = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));

  // Run the exact same seed script that vercel-build uses, but against test.db
  execFileSync(
    process.execPath,
    [tsxCli, "prisma/seed.ts"],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: "file:./test.db" },
      stdio: "inherit",
    },
  );
}

async function cleanupDemoDatabase(): Promise<void> {
  // Clean up demo data created by the seed
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.assistantQueryLog.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.complaintResponse.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.borrowRecord.deleteMany();
  await prisma.book.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.markEntry.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.timetableVersion.deleteMany();
  await prisma.facultyAvailability.deleteMany();
  await prisma.enrolment.deleteMany();
  await prisma.subjectOffering.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.facultyProfile.deleteMany();
  await prisma.period.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.course.deleteMany();
  await prisma.department.deleteMany();
  await prisma.academicTerm.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await seedDemoDatabase();
}, 120_000);

afterAll(async () => {
  try {
    await cleanupDemoDatabase();
  } finally {
    await prisma.$disconnect();
  }
});

describe("demo authentication against seeded test database", () => {
  it("admin account (adm001) authenticates successfully", async () => {
    const user = await authenticate("adm001", DEMO_PASSWORD);
    expect(user.role).toBe("ADMIN");
    expect(user.email).toBe("admin@campus.edu");
    expect(user.id).toBeTruthy();
  });

  it("faculty account (fac001) authenticates successfully", async () => {
    const user = await authenticate("fac001", DEMO_PASSWORD);
    expect(user.role).toBe("FACULTY");
    expect(user.email).toBe("ananya.rao@campus.edu");
    expect(user.id).toBeTruthy();
  });

  it("student account (cse-26a-001) authenticates successfully", async () => {
    const user = await authenticate("cse-26a-001", DEMO_PASSWORD);
    expect(user.role).toBe("STUDENT");
    expect(user.email).toBe("student001@campus.edu");
    expect(user.id).toBeTruthy();
  });

  it("rejects wrong password for admin", async () => {
    await expect(authenticate("adm001", "wrong-password")).rejects.toThrow(UnauthorizedError);
  });

  it("rejects wrong password for faculty", async () => {
    await expect(authenticate("fac001", "wrong-password")).rejects.toThrow(UnauthorizedError);
  });

  it("rejects wrong password for student", async () => {
    await expect(authenticate("cse-26a-001", "wrong-password")).rejects.toThrow(UnauthorizedError);
  });
});

describe("seed demo identifiers match DEMO_ACCOUNTS", () => {
  it("admin loginId in database equals DEMO_ACCOUNTS[0].loginId", async () => {
    const user = await prisma.user.findUnique({
      where: { loginId: DEMO_ACCOUNTS[0]!.loginId },
      select: { loginId: true, email: true, role: true },
    });
    expect(user).not.toBeNull();
    expect(user!.loginId).toBe(DEMO_ACCOUNTS[0]!.loginId);
    expect(user!.email).toBe(DEMO_ACCOUNTS[0]!.email);
    expect(user!.role).toBe("ADMIN");
  });

  it("faculty loginId in database equals DEMO_ACCOUNTS[1].loginId", async () => {
    const user = await prisma.user.findUnique({
      where: { loginId: DEMO_ACCOUNTS[1]!.loginId },
      select: { loginId: true, email: true, role: true },
    });
    expect(user).not.toBeNull();
    expect(user!.loginId).toBe(DEMO_ACCOUNTS[1]!.loginId);
    expect(user!.email).toBe(DEMO_ACCOUNTS[1]!.email);
    expect(user!.role).toBe("FACULTY");
  });

  it("student loginId in database equals DEMO_ACCOUNTS[2].loginId", async () => {
    const user = await prisma.user.findUnique({
      where: { loginId: DEMO_ACCOUNTS[2]!.loginId },
      select: { loginId: true, email: true, role: true },
    });
    expect(user).not.toBeNull();
    expect(user!.loginId).toBe(DEMO_ACCOUNTS[2]!.loginId);
    expect(user!.email).toBe(DEMO_ACCOUNTS[2]!.email);
    expect(user!.role).toBe("STUDENT");
  });

  it("student loginId matches the seed roll-number derivation formula", async () => {
    // The seed derives the first student's loginId from "CSE-2026-A" batch, index 1
    const expectedLoginId = seedRollToLoginId("CSE-2026-A", 1);
    const user = await prisma.user.findUnique({
      where: { loginId: expectedLoginId },
      select: { loginId: true },
    });
    expect(user).not.toBeNull();
    expect(user!.loginId).toBe(expectedLoginId);
    expect(user!.loginId).toBe(DEMO_ACCOUNTS[2]!.loginId);
  });

  it("all three demo accounts exist and have the correct password hash", async () => {
    for (const account of DEMO_ACCOUNTS) {
      const user = await prisma.user.findUnique({
        where: { loginId: account.loginId },
        select: { passwordHash: true, isActive: true },
      });
      expect(user).not.toBeNull();
      expect(user!.isActive).toBe(true);
      expect(user!.passwordHash).toBeTruthy();
      // Verify the password hash matches DEMO_PASSWORD
      const bcrypt = await import("bcryptjs");
      const matches = await bcrypt.compare(DEMO_PASSWORD, user!.passwordHash);
      expect(matches).toBe(true);
    }
  });
});