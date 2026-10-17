import { prisma } from "../db";
import { writeAudit } from "../audit";
import { createNotification } from "../notifications";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { Actor, authorize } from "../permissions";
import { getAttendanceThreshold } from "../settings";
import type { AttendanceInput } from "../validation";

/**
 * Attendance percentage (M06-R05, AC-M06-04).
 *
 * Pure and unit-testable. An empty set of sessions is defined as 0% with
 * `hasData = false`, so callers can show an "no sessions yet" state instead of
 * a misleading 100%.
 */
export function computeAttendancePercent(
  records: { status: string }[],
): { present: number; total: number; percent: number; hasData: boolean } {
  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const percent = total === 0 ? 0 : Math.round((present / total) * 100);
  return { present, total, percent, hasData: total > 0 };
}

/** Faculty creates a dated class session for one of their offerings. */
export async function createClassSession(
  actor: Actor,
  input: {
    offeringId: string;
    date: string;
    day: number;
    periodIndex: number;
    topic?: string;
  },
) {
  const offering = await prisma.subjectOffering.findUnique({
    where: { id: input.offeringId },
  });
  if (!offering) throw new NotFoundError("Subject offering not found.");
  authorize(actor, "attendance:record", {
    assignedFacultyId: offering.facultyId,
  });

  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Please provide a valid date.");
  }

  const session = await prisma.classSession.create({
    data: {
      offeringId: offering.id,
      date,
      day: input.day,
      periodIndex: input.periodIndex,
      topic: input.topic ?? null,
    },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "attendance.session.create",
    entityType: "ClassSession",
    entityId: session.id,
    summary: `Created class session for offering ${offering.id}`,
  });
  return session;
}

/**
 * Record or update Present/Absent for a session (M06-R02/R03).
 * Enforces assignment scope (SEC-Z03) and rejects students outside the batch.
 */
export async function recordAttendance(actor: Actor, input: AttendanceInput) {
  const session = await prisma.classSession.findUnique({
    where: { id: input.classSessionId },
    include: { offering: true },
  });
  if (!session) throw new NotFoundError("Class session not found.");
  authorize(actor, "attendance:record", {
    assignedFacultyId: session.offering.facultyId,
  });

  const studentIds = input.entries.map((e) => e.studentId);
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds } },
  });
  if (students.length !== new Set(studentIds).size) {
    throw new ValidationError("One or more students could not be found.");
  }
  const wrongBatch = students.find((s) => s.batchId !== session.offering.batchId);
  if (wrongBatch) {
    throw new ForbiddenError(
      "Attendance can only be recorded for students in the offered batch.",
    );
  }

  const before = await prisma.attendanceRecord.findMany({
    where: { classSessionId: session.id, studentId: { in: studentIds } },
  });
  const beforeMap = new Map(before.map((b) => [b.studentId, b.status]));

  for (const entry of input.entries) {
    await prisma.attendanceRecord.upsert({
      where: {
        classSessionId_studentId: {
          classSessionId: session.id,
          studentId: entry.studentId,
        },
      },
      create: {
        classSessionId: session.id,
        studentId: entry.studentId,
        status: entry.status,
        markedById: actor.id,
      },
      update: { status: entry.status, markedById: actor.id },
    });
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: before.length > 0 ? "attendance.update" : "attendance.create",
    entityType: "ClassSession",
    entityId: session.id,
    summary: JSON.stringify({
      entries: input.entries.length,
      changed: input.entries
        .filter((e) => beforeMap.get(e.studentId) !== e.status)
        .map((e) => ({
          studentId: e.studentId,
          from: beforeMap.get(e.studentId) ?? null,
          to: e.status,
        })),
    }),
  });

  // Low-attendance check (M06-R06/R07): one alert per (student, offering).
  const threshold = await getAttendanceThreshold();
  for (const entry of input.entries) {
    const all = await prisma.attendanceRecord.findMany({
      where: {
        studentId: entry.studentId,
        classSession: { offeringId: session.offeringId },
      },
      select: { status: true },
    });
    const { percent, hasData } = computeAttendancePercent(all);
    if (hasData && percent < threshold) {
      const student = students.find((s) => s.id === entry.studentId)!;
      await createNotification({
        userId: student.userId,
        type: "LOW_ATTENDANCE",
        title: "Low attendance warning",
        body: `Your attendance is ${percent}%, below the required ${threshold}%. Please contact your faculty.`,
        link: "/student/attendance",
        idempotencyKey: `lowatt:${entry.studentId}:${session.offeringId}`,
      });
    }
  }

  return { saved: input.entries.length };
}

/** Students see only their own attendance (SEC-Z02, M06-R04). */
export async function getMyAttendance(actor: Actor) {
  if (actor.role !== "STUDENT" || !actor.studentProfileId) {
    throw new ForbiddenError("Only students have personal attendance.");
  }
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: actor.studentProfileId },
    include: {
      classSession: {
        include: { offering: { include: { subject: true } } },
      },
    },
    orderBy: { classSession: { date: "desc" } },
  });

  const byOffering = new Map<
    string,
    {
      offeringId: string;
      subject: string;
      subjectCode: string;
      facultyId: string;
      records: { status: string; date: Date }[];
    }
  >();
  for (const r of records) {
    const off = r.classSession.offering;
    const entry = byOffering.get(off.id) ?? {
      offeringId: off.id,
      subject: off.subject.name,
      subjectCode: off.subject.code,
      facultyId: off.facultyId,
      records: [],
    };
    entry.records.push({ status: r.status, date: r.classSession.date });
    byOffering.set(off.id, entry);
  }

  const summaries = Array.from(byOffering.values()).map((e) => ({
    ...e,
    ...computeAttendancePercent(e.records),
  }));
  const overall = computeAttendancePercent(records.map((r) => ({ status: r.status })));
  return { summaries, overall };
}

/** Faculty's recent class sessions with attendance counts (M06). */
export async function listFacultySessions(actor: Actor) {
  if (actor.role !== "FACULTY") return [];
  const sessions = await prisma.classSession.findMany({
    where: { offering: { facultyId: actor.id } },
    include: {
      offering: { include: { subject: true, batch: true } },
      _count: { select: { records: true } },
    },
    orderBy: [{ date: "desc" }],
    take: 40,
  });
  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    day: s.day,
    periodIndex: s.periodIndex,
    topic: s.topic,
    subjectCode: s.offering.subject.code,
    subjectName: s.offering.subject.name,
    batchName: s.offering.batch.name,
    batchStrength: s.offering.batch.strength,
    marked: s._count.records,
  }));
}

/** Session detail for attendance recording (faculty-owned only, SEC-Z03). */
export async function getSessionForRecording(actor: Actor, sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: { offering: { include: { subject: true, batch: true } } },
  });
  if (!session) throw new NotFoundError("Class session not found.");
  authorize(actor, "attendance:record", {
    assignedFacultyId: session.offering.facultyId,
  });
  const students = await prisma.studentProfile.findMany({
    where: { batchId: session.offering.batchId },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { rollNo: "asc" },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: { classSessionId: sessionId },
  });
  const existing: Record<string, string> = {};
  for (const r of records) existing[r.studentId] = r.status;
  return {
    session,
    students: students.map((s) => ({
      studentId: s.id,
      rollNo: s.rollNo,
      name: `${s.user.firstName} ${s.user.lastName}`,
    })),
    existing,
  };
}

/** Faculty/admin view of attendance for one offering. */
export async function getOfferingAttendance(actor: Actor, offeringId: string) {
  const offering = await prisma.subjectOffering.findUnique({
    where: { id: offeringId },
    include: { subject: true, batch: true },
  });
  if (!offering) throw new NotFoundError("Offering not found.");
  authorize(actor, "attendance:record", {
    assignedFacultyId: offering.facultyId,
  });

  const students = await prisma.studentProfile.findMany({
    where: { batchId: offering.batchId },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { rollNo: "asc" },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: { classSession: { offeringId } },
    select: { studentId: true, status: true },
  });
  const byStudent = new Map<string, { status: string }[]>();
  for (const r of records) {
    const arr = byStudent.get(r.studentId) ?? [];
    arr.push({ status: r.status });
    byStudent.set(r.studentId, arr);
  }
  const threshold = await getAttendanceThreshold();

  return {
    offering,
    threshold,
    students: students.map((s) => {
      const stat = computeAttendancePercent(byStudent.get(s.id) ?? []);
      return {
        studentId: s.id,
        rollNo: s.rollNo,
        name: `${s.user.firstName} ${s.user.lastName}`,
        ...stat,
        belowThreshold: stat.hasData && stat.percent < threshold,
      };
    }),
  };
}
