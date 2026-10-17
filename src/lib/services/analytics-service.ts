import { prisma } from "../db";
import { getAttendanceThreshold } from "../settings";
import { computeAttendancePercent } from "./attendance-service";
import { Actor } from "../permissions";

/** Headline counts for the admin dashboard. */
export async function getAdminOverview() {
  const [
    students,
    faculty,
    courses,
    batches,
    subjects,
    classrooms,
    notices,
    publishedTimetables,
    openComplaints,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "FACULTY" } }),
    prisma.course.count(),
    prisma.batch.count(),
    prisma.subject.count(),
    prisma.classroom.count(),
    prisma.notice.count(),
    prisma.timetableVersion.count({ where: { status: "PUBLISHED" } }),
    prisma.complaint.count({
      where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } },
    }),
  ]);
  const attendance = await getInstituteAttendance();
  const threshold = await getAttendanceThreshold();
  return {
    students,
    faculty,
    courses,
    batches,
    subjects,
    classrooms,
    notices,
    publishedTimetables,
    openComplaints,
    attendance,
    threshold,
  };
}

export async function getInstituteAttendance() {
  const records = await prisma.attendanceRecord.findMany({
    select: { status: true },
  });
  return computeAttendancePercent(records);
}

/** Attendance percentage per subject for a batch (M07-R01/R03). */
export async function getBatchAttendanceBySubject(batchId: string) {
  const offerings = await prisma.subjectOffering.findMany({
    where: { batchId },
    include: { subject: true },
  });
  const out: { subject: string; percent: number; sessions: number }[] = [];
  for (const o of offerings) {
    const records = await prisma.attendanceRecord.findMany({
      where: { classSession: { offeringId: o.id } },
      select: { status: true },
    });
    const stat = computeAttendancePercent(records);
    out.push({
      subject: o.subject.code,
      percent: stat.percent,
      sessions: stat.total,
    });
  }
  return out;
}

/** Subject-wise marks statistics for a batch (M07-R02). */
export async function getBatchMarkStats(batchId: string) {
  const exams = await prisma.exam.findMany({
    where: { batchId },
    include: { subject: true },
  });
  const out: {
    subject: string;
    exam: string;
    average: number;
    highest: number;
    lowest: number;
    passRate: number;
    count: number;
  }[] = [];
  for (const exam of exams) {
    const marks = await prisma.markEntry.findMany({ where: { examId: exam.id } });
    if (marks.length === 0) continue;
    const values = marks.map((m) => m.marks);
    const average = values.reduce((s, v) => s + v, 0) / values.length;
    const pass = values.filter((v) => v >= exam.maxMarks * 0.4).length;
    out.push({
      subject: exam.subject.code,
      exam: exam.name,
      average: Math.round(average * 10) / 10,
      highest: Math.max(...values),
      lowest: Math.min(...values),
      passRate: Math.round((pass / values.length) * 100),
      count: values.length,
    });
  }
  return out;
}

/** Students who may need academic support (M07-R05, M06-R06). */
export async function getAtRiskStudents() {
  const threshold = await getAttendanceThreshold();
  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { firstName: true, lastName: true } },
      batch: { select: { name: true } },
    },
  });

  const results: {
    studentId: string;
    rollNo: string;
    name: string;
    batch: string;
    percent: number;
    reason: string;
  }[] = [];

  for (const s of students) {
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: s.id },
      select: { status: true },
    });
    const stat = computeAttendancePercent(records);
    if (stat.hasData && stat.percent < threshold) {
      results.push({
        studentId: s.id,
        rollNo: s.rollNo,
        name: `${s.user.firstName} ${s.user.lastName}`,
        batch: s.batch?.name ?? "—",
        percent: stat.percent,
        reason: `Attendance ${stat.percent}% below ${threshold}%`,
      });
    }
  }
  return results.sort((a, b) => a.percent - b.percent);
}

/** Per-day attendance trend across the institute (M07-R01). */
export async function getAttendanceTrend() {
  const sessions = await prisma.classSession.findMany({
    select: { id: true, date: true },
    orderBy: { date: "asc" },
  });
  const byDate = new Map<string, { present: number; total: number }>();
  const sessionDate = new Map(sessions.map((s) => [s.id, s.date]));
  const records = await prisma.attendanceRecord.findMany({
    select: { classSessionId: true, status: true },
  });
  for (const r of records) {
    const date = sessionDate.get(r.classSessionId);
    if (!date) continue;
    const key = date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? { present: 0, total: 0 };
    entry.total++;
    if (r.status === "PRESENT") entry.present++;
    byDate.set(key, entry);
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      percent: v.total ? Math.round((v.present / v.total) * 100) : 0,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Student's own performance snapshot. */
export async function getStudentOverview(actor: Actor) {
  if (actor.role !== "STUDENT" || !actor.studentProfileId) {
    return null;
  }
  const [attendanceRecords, marks, assignments, borrows] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId: actor.studentProfileId },
      select: { status: true },
    }),
    prisma.markEntry.findMany({
      where: { studentId: actor.studentProfileId, exam: { resultPublished: true } },
      include: { exam: true },
    }),
    prisma.assignment.count({
      where: { offering: { batchId: actor.batchId ?? "__none__" } },
    }),
    prisma.borrowRecord.count({
      where: { userId: actor.id, returnedAt: null },
    }),
  ]);
  const attendance = computeAttendancePercent(attendanceRecords);
  const avgMark =
    marks.length > 0
      ? Math.round(
          marks.reduce((s, m) => s + (m.marks / m.exam.maxMarks) * 100, 0) /
            marks.length,
        )
      : 0;
  const threshold = await getAttendanceThreshold();
  return {
    attendance: attendance.percent,
    attendancePresent: attendance.present,
    attendanceTotal: attendance.total,
    averageMark: avgMark,
    resultsCount: marks.length,
    assignments,
    activeBorrows: borrows,
    threshold,
    belowThreshold: attendance.hasData && attendance.percent < threshold,
  };
}

export async function getFacultyOverview(actor: Actor) {
  if (actor.role !== "FACULTY") return null;
  const offerings = await prisma.subjectOffering.findMany({
    where: { facultyId: actor.id },
    include: { subject: true, batch: true },
  });
  const offeringIds = offerings.map((o) => o.id);
  const [sessions, records, assignments, slots] = await Promise.all([
    prisma.classSession.count({ where: { offeringId: { in: offeringIds } } }),
    prisma.attendanceRecord.findMany({
      where: { classSession: { offeringId: { in: offeringIds } } },
      select: { status: true },
    }),
    prisma.assignment.count({ where: { offeringId: { in: offeringIds } } }),
    prisma.timetableSlot.count({ where: { facultyId: actor.id } }),
  ]);
  const attendance = computeAttendancePercent(records);
  return {
    offerings: offerings.length,
    batches: new Set(offerings.map((o) => o.batchId)).size,
    sessions,
    attendancePercent: attendance.percent,
    assignments,
    weeklySlots: slots,
    subjects: offerings.map((o) => ({
      id: o.id,
      code: o.subject.code,
      name: o.subject.name,
      batch: o.batch.name,
    })),
  };
}
