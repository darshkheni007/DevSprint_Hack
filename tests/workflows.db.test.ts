import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { authenticate } from "@/lib/services/auth-service";
import { createSwapRequest, decideSwap } from "@/lib/services/swap-service";
import { cancelLecture } from "@/lib/services/cancellation-service";
import { createNotice, noticesLinkFor } from "@/lib/services/notice-service";
import {
  cleanupCampus,
  dateForWeekday,
  dateForWeekdayInYear,
  otherWeekday,
  seedCampus,
  TEST_PASSWORD,
  toKey,
  type Fixture,
} from "./helpers/fixtures";

/**
 * End-to-end service tests against an isolated SQLite database
 * (prisma/test.db, force-reset by tests/global-setup.ts).
 *
 * Tests run in declared order and share one fixture; later tests depend on the
 * timetable state left by earlier ones (documented per test).
 */
let f: Fixture;

beforeAll(async () => {
  f = await seedCampus("wf");
}, 60_000);

afterAll(async () => {
  if (f) await cleanupCampus(f);
});

async function slot(slotId: string) {
  return prisma.timetableSlot.findUniqueOrThrow({ where: { id: slotId } });
}

// ---------------------------------------------------------------------------
// Priority 1 — student login
// ---------------------------------------------------------------------------

describe("student authentication (DB)", () => {
  it("accepts the stored student login id", async () => {
    const user = await authenticate(`st1-wf`, TEST_PASSWORD);
    expect(user.id).toBe(f.student1.userId);
    expect(user.role).toBe("STUDENT");
  });

  it("rejects a wrong password", async () => {
    await expect(authenticate(`st1-wf`, "wrong-password")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects an inactive account even with the correct password", async () => {
    await prisma.user.update({ where: { id: f.student2.userId }, data: { isActive: false } });
    await expect(authenticate(`st2-wf`, TEST_PASSWORD)).rejects.toThrow(
      UnauthorizedError,
    );
    await prisma.user.update({ where: { id: f.student2.userId }, data: { isActive: true } });
  });
});

// ---------------------------------------------------------------------------
// Priority 2 — faculty lecture swap
// ---------------------------------------------------------------------------

describe("lecture swap workflow (DB)", () => {
  it("rejects a self-swap", async () => {
    await expect(
      createSwapRequest(f.facultyA.actor, {
        requesterSlotId: f.slots.A1,
        recipientSlotId: f.slots.A2,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a request for a slot the actor does not own", async () => {
    await expect(
      createSwapRequest(f.facultyB.actor, {
        requesterSlotId: f.slots.A1,
        recipientSlotId: f.slots.B1,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("forbids students from requesting a swap", async () => {
    await expect(
      createSwapRequest(f.student1.actor, {
        requesterSlotId: f.slots.A1,
        recipientSlotId: f.slots.B1,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  let r1 = "";
  it("creates a pending request without changing the timetable, and notifies the recipient", async () => {
    const before = { a: await slot(f.slots.A1), b: await slot(f.slots.B1) };
    const created = await createSwapRequest(f.facultyA.actor, {
      requesterSlotId: f.slots.A1,
      recipientSlotId: f.slots.B1,
      reason: "Conference",
    });
    r1 = created.id;
    expect(created.status).toBe("PENDING");

    const after = { a: await slot(f.slots.A1), b: await slot(f.slots.B1) };
    expect([after.a.day, after.a.periodIndex]).toEqual([before.a.day, before.a.periodIndex]);
    expect([after.b.day, after.b.periodIndex]).toEqual([before.b.day, before.b.periodIndex]);

    const notified = await prisma.notification.count({
      where: { idempotencyKey: { startsWith: `swap:requested:${r1}` } },
    });
    expect(notified).toBe(1);
  });

  it("prevents an identical duplicate request", async () => {
    await expect(
      createSwapRequest(f.facultyA.actor, {
        requesterSlotId: f.slots.A1,
        recipientSlotId: f.slots.B1,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("only the recipient may decide", async () => {
    await expect(
      decideSwap(f.facultyA.actor, { requestId: r1, decision: "ACCEPT" }),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      decideSwap(f.student1.actor, { requestId: r1, decision: "REJECT" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejecting leaves the timetable unchanged", async () => {
    const result = await decideSwap(f.facultyB.actor, { requestId: r1, decision: "REJECT" });
    expect(result.status).toBe("REJECTED");

    const a = await slot(f.slots.A1);
    const b = await slot(f.slots.B1);
    expect([a.day, a.periodIndex]).toEqual([1, 1]);
    expect([b.day, b.periodIndex]).toEqual([2, 2]);

    const row = await prisma.lectureSwapRequest.findUniqueOrThrow({ where: { id: r1 } });
    expect(row.status).toBe("REJECTED");
    expect(row.finalizedAt).toBeNull();
  });

  it("a conflicting swap fails safely and leaves the timetable unchanged", async () => {
    const created = await createSwapRequest(f.facultyA.actor, {
      requesterSlotId: f.slots.A1,
      recipientSlotId: f.slots.B1,
    });
    // Faculty A already teaches batch 2 at (day 2, period 2) — the swap would
    // double-book them, so it must be refused inside the transaction.
    await expect(
      decideSwap(f.facultyB.actor, { requestId: created.id, decision: "ACCEPT" }),
    ).rejects.toThrow(ConflictError);

    const row = await prisma.lectureSwapRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe("FAILED");
    expect(row.failureReason).toBeTruthy();

    const a = await slot(f.slots.A1);
    const b = await slot(f.slots.B1);
    expect([a.day, a.periodIndex]).toEqual([1, 1]);
    expect([b.day, b.periodIndex]).toEqual([2, 2]);

    const failedAudit = await prisma.auditLog.count({
      where: { action: "swap.finalize.failed", entityId: created.id },
    });
    expect(failedAudit).toBe(1);
    const failedNotice = await prisma.notification.count({
      where: { idempotencyKey: { startsWith: `swap:failed:${created.id}` } },
    });
    expect(failedNotice).toBe(1);
  });

  it("a valid swap is applied only after both faculty consent", async () => {
    const created = await createSwapRequest(f.facultyA.actor, {
      requesterSlotId: f.slots.A2,
      recipientSlotId: f.slots.B2,
    });

    // Consent alone does not move anything.
    const pending = await slot(f.slots.A2);
    expect([pending.day, pending.periodIndex]).toEqual([3, 3]);

    const result = await decideSwap(f.facultyB.actor, { requestId: created.id, decision: "ACCEPT" });
    expect(result.status).toBe("FINALIZED");

    const a = await slot(f.slots.A2);
    const b = await slot(f.slots.B2);
    expect([a.day, a.periodIndex]).toEqual([4, 4]);
    expect([b.day, b.periodIndex]).toEqual([3, 3]);

    const row = await prisma.lectureSwapRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.requesterApproved).toBe(true);
    expect(row.recipientApproved).toBe(true);
    expect(row.finalizedAt).not.toBeNull();

    const facultyNotice = await prisma.notification.count({
      where: { idempotencyKey: { startsWith: `swap:finalized:faculty:${created.id}` } },
    });
    expect(facultyNotice).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Priority 3 — lecture cancellation
// ---------------------------------------------------------------------------

describe("lecture cancellation workflow (DB)", () => {
  // A1 is never moved by the swap tests above (it is only involved in the
  // rejected / failed attempts), but we still read its day from the database so
  // this suite cannot be broken by an unrelated timetable change.
  let targetSlotId = "";
  let targetDay = 1;
  let targetPeriod = 1;
  let cancelDate = dateForWeekday(1);
  let otherDate = dateForWeekday(otherWeekday(1));
  let sessionId = "";
  let attendanceId = "";
  let markId = "";

  beforeAll(async () => {
    const a1 = await prisma.timetableSlot.findUniqueOrThrow({ where: { id: f.slots.A1 } });
    targetSlotId = a1.id;
    targetDay = a1.day;
    targetPeriod = a1.periodIndex;
    cancelDate = dateForWeekday(targetDay);
    otherDate = dateForWeekday(otherWeekday(targetDay));
  });

  it("records attendance and marks before the cancellation", async () => {
    const a1 = await slot(targetSlotId);
    const s = await prisma.classSession.create({
      data: {
        offeringId: a1.offeringId,
        slotId: a1.id,
        classroomId: a1.classroomId,
        date: cancelDate,
        day: a1.day,
        periodIndex: a1.periodIndex,
      },
    });
    sessionId = s.id;
    const att = await prisma.attendanceRecord.create({
      data: { classSessionId: s.id, studentId: f.student1.profileId, status: "PRESENT", markedById: f.facultyA.userId },
    });
    attendanceId = att.id;
    const offering = await prisma.subjectOffering.findUniqueOrThrow({ where: { id: a1.offeringId } });
    const exam = await prisma.exam.create({
      data: {
        subjectId: offering.subjectId,
        batchId: f.batch1Id,
        termId: f.termId,
        name: `Midterm ${cancelDate.getUTCFullYear()}`,
        examDate: cancelDate,
        startTime: "09:00",
        endTime: "11:00",
        maxMarks: 100,
      },
    });
    const mark = await prisma.markEntry.create({
      data: { examId: exam.id, studentId: f.student1.profileId, marks: 70, enteredById: f.facultyA.userId },
    });
    markId = mark.id;
    expect(attendanceId).toBeTruthy();
  });

  it("cancels one occurrence, links the existing session and keeps history", async () => {
    const result = await cancelLecture(f.facultyA.actor, {
      slotId: targetSlotId,
      date: toKey(cancelDate),
      reason: "Faculty on duty leave",
    });
    expect(result.duplicate).toBe(false);

    const row = await prisma.lectureCancellation.findUniqueOrThrow({
      where: { slotId_date: { slotId: targetSlotId, date: cancelDate } },
    });
    expect(row.classSessionId).toBe(sessionId);
    expect(row.cancelledById).toBe(f.facultyA.userId);

    // The recurring slot still exists and did not move.
    const a1 = await slot(targetSlotId);
    expect([a1.day, a1.periodIndex]).toEqual([targetDay, targetPeriod]);

    // Attendance and marks are untouched.
    const att = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: attendanceId } });
    expect(att.status).toBe("PRESENT");
    const mark = await prisma.markEntry.findUniqueOrThrow({ where: { id: markId } });
    expect(mark.marks).toBe(70);
  });

  it("notifies students and faculty exactly once", async () => {
    const studentNotices = await prisma.notification.count({
      where: { idempotencyKey: { startsWith: `lecture:cancelled:students:${targetSlotId}:${toKey(cancelDate)}` } },
    });
    expect(studentNotices).toBe(2); // two students in the batch
    const facultyNotices = await prisma.notification.count({
      where: { idempotencyKey: { startsWith: `lecture:cancelled:faculty:${targetSlotId}:${toKey(cancelDate)}` } },
    });
    expect(facultyNotices).toBeGreaterThanOrEqual(1);
  });

  it("is idempotent: a repeat cancellation creates no duplicate row or notification", async () => {
    const before = await prisma.notification.count();
    const result = await cancelLecture(f.facultyA.actor, {
      slotId: targetSlotId,
      date: toKey(cancelDate),
      reason: "Duplicate attempt",
    });
    expect(result.duplicate).toBe(true);

    const rows = await prisma.lectureCancellation.count({
      where: { slotId: targetSlotId, date: cancelDate },
    });
    expect(rows).toBe(1);
    const after = await prisma.notification.count();
    expect(after).toBe(before);
  });

  it("rejects a date that does not fall on the lecture's weekday", async () => {
    await expect(
      cancelLecture(f.facultyA.actor, { slotId: targetSlotId, date: toKey(otherDate) }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a date outside the academic term", async () => {
    // Same weekday, but the following year (the term ends 2026-12-31).
    const outOfTerm = dateForWeekdayInYear(targetDay, 2027);
    await expect(
      cancelLecture(f.facultyA.actor, { slotId: targetSlotId, date: toKey(outOfTerm) }),
    ).rejects.toThrow(ValidationError);
  });

  it("forbids cancelling another faculty member's lecture", async () => {
    await expect(
      cancelLecture(f.facultyB.actor, { slotId: targetSlotId, date: toKey(cancelDate) }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("forbids students from cancelling lectures", async () => {
    await expect(
      cancelLecture(f.student1.actor, { slotId: targetSlotId, date: toKey(cancelDate) }),
    ).rejects.toThrow(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// Priority 3 — notice notification links
// ---------------------------------------------------------------------------

describe("notice notification links (DB)", () => {
  // Must run before cleanupCampus: Notice.createdById references the admin user.
  afterAll(async () => {
    if (f) await prisma.notice.deleteMany({ where: { createdById: f.admin.userId } });
  });

  it("deep-links every recipient to the notices page that exists for their role", async () => {
    const existing = new Set(
      (await prisma.notification.findMany({ select: { id: true } })).map((n) => n.id),
    );

    const notice = await createNotice(f.admin.actor, {
      title: "Regression notice",
      body: "Verifying role-aware notification links.",
      audience: "ALL",
    });
    expect(notice.audience).toBe("ALL");

    const created = await prisma.notification.findMany({
      where: { id: { notIn: [...existing] }, type: "NOTICE" },
      select: { userId: true, link: true },
    });
    expect(created.length).toBe(f.userIds.length);

    const roles = new Map(
      (
        await prisma.user.findMany({
          where: { id: { in: f.userIds } },
          select: { id: true, role: true },
        })
      ).map((u) => [u.id, u.role] as const),
    );

    for (const n of created) {
      const role = roles.get(n.userId);
      expect(role).toBeDefined();
      // Regression: this used to be a bare "/notices", which 404s for everyone.
      expect(n.link).toBe(noticesLinkFor(role as string));
      expect(n.link).not.toBe("/notices");
    }

    // All three roles were actually exercised.
    expect([...new Set(created.map((n) => roles.get(n.userId)))].sort()).toEqual([
      "ADMIN",
      "FACULTY",
      "STUDENT",
    ]);
  });
});
