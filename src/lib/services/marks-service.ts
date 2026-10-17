import { prisma } from "../db";
import { writeAudit } from "../audit";
import { notifyUsers } from "../notifications";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { Actor, authorize } from "../permissions";
import type { MarksInput } from "../validation";
import { examSchema } from "../validation";
import type { z } from "zod";

/** Resolve the faculty assigned to a subject+batch+term offering. */
async function facultyForExam(examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new NotFoundError("Exam not found.");
  const offering = await prisma.subjectOffering.findFirst({
    where: {
      subjectId: exam.subjectId,
      batchId: exam.batchId,
      termId: exam.termId,
    },
  });
  return { exam, offering };
}

/**
 * Faculty enters/updates marks (M11-R02, AC-M11-02).
 * Range `0 <= marks <= maxMarks` is enforced here and re-checked by Zod.
 * Students have no write path to this function (SEC-Z07).
 */
export async function enterMarks(actor: Actor, input: MarksInput) {
  const { exam, offering } = await facultyForExam(input.examId);
  if (!offering) throw new NotFoundError("No offering found for this exam.");
  authorize(actor, "marks:enter", { assignedFacultyId: offering.facultyId });

  const studentIds = input.entries.map((e) => e.studentId);
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds } },
  });
  if (students.length !== new Set(studentIds).size) {
    throw new ValidationError("One or more students could not be found.");
  }
  const wrongBatch = students.find((s) => s.batchId !== exam.batchId);
  if (wrongBatch) {
    throw new ForbiddenError("Marks can only be entered for the exam's batch.");
  }

  const before = await prisma.markEntry.findMany({
    where: { examId: exam.id, studentId: { in: studentIds } },
  });
  const beforeMap = new Map(before.map((b) => [b.studentId, b.marks]));

  for (const entry of input.entries) {
    if (entry.marks < 0 || entry.marks > exam.maxMarks) {
      throw new ValidationError(
        `Marks must be between 0 and ${exam.maxMarks}.`,
        { marks: [`Marks must be between 0 and ${exam.maxMarks}.`] },
      );
    }
    await prisma.markEntry.upsert({
      where: { examId_studentId: { examId: exam.id, studentId: entry.studentId } },
      create: {
        examId: exam.id,
        studentId: entry.studentId,
        marks: entry.marks,
        enteredById: actor.id,
      },
      update: { marks: entry.marks, enteredById: actor.id },
    });
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: before.length > 0 ? "marks.update" : "marks.create",
    entityType: "Exam",
    entityId: exam.id,
    summary: JSON.stringify({
      changes: input.entries
        .filter((e) => beforeMap.get(e.studentId) !== e.marks)
        .map((e) => ({
          studentId: e.studentId,
          from: beforeMap.get(e.studentId) ?? null,
          to: e.marks,
        })),
    }),
  });

  return { saved: input.entries.length };
}

/** Admin publishes results (M11-R03, SEC-Z06) and notifies students. */
export async function publishResults(actor: Actor, examId: string) {
  authorize(actor, "results:publish");
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new NotFoundError("Exam not found.");

  await prisma.exam.update({
    where: { id: examId },
    data: { resultPublished: true, publishedAt: new Date() },
  });

  const students = await prisma.studentProfile.findMany({
    where: { batchId: exam.batchId },
    select: { userId: true },
  });
  await notifyUsers(
    students.map((s) => s.userId),
    {
      type: "EXAM_REMINDER",
      title: "Results published",
      body: `Results for "${exam.name}" are now available.`,
      link: "/student/results",
      idempotencyKey: `results:published:${examId}`,
    },
  );

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "results.publish",
    entityType: "Exam",
    entityId: examId,
    summary: `Published results for ${exam.name}`,
  });
}

/** Student sees only their own PUBLISHED marks (M04-R02, SEC-Z06, AC-M04-02). */
export async function getMyResults(actor: Actor) {
  if (actor.role !== "STUDENT" || !actor.studentProfileId) {
    throw new ForbiddenError("Only students have personal results.");
  }
  const entries = await prisma.markEntry.findMany({
    where: {
      studentId: actor.studentProfileId,
      exam: { resultPublished: true },
    },
    include: { exam: { include: { subject: true } } },
    orderBy: { exam: { examDate: "desc" } },
  });
  return entries.map((e) => ({
    examId: e.examId,
    examName: e.exam.name,
    subject: e.exam.subject.name,
    subjectCode: e.exam.subject.code,
    marks: e.marks,
    maxMarks: e.exam.maxMarks,
    percent: Math.round((e.marks / e.exam.maxMarks) * 100),
    examDate: e.exam.examDate,
  }));
}

/** Exams visible to the actor (admin: all; faculty: their own offerings). */
export async function listExams(actor: Actor) {
  authorize(actor, "exam:read");
  const exams = await prisma.exam.findMany({
    include: {
      subject: true,
      batch: true,
      classroom: true,
      _count: { select: { marks: true } },
    },
    orderBy: { examDate: "desc" },
  });
  if (actor.role !== "FACULTY") return exams;
  const offerings = await prisma.subjectOffering.findMany({
    where: { facultyId: actor.id },
    select: { subjectId: true, batchId: true, termId: true },
  });
  const key = (s: string, b: string, t: string) => `${s}:${b}:${t}`;
  const allowed = new Set(offerings.map((o) => key(o.subjectId, o.batchId, o.termId)));
  return exams.filter((e) => allowed.has(key(e.subjectId, e.batchId, e.termId)));
}

/** Admin schedules an examination (M11-R01). */
export async function createExam(
  actor: Actor,
  input: z.infer<typeof examSchema>,
) {
  authorize(actor, "exam:manage");
  const exam = await prisma.exam.create({
    data: {
      subjectId: input.subjectId,
      batchId: input.batchId,
      termId: input.termId,
      name: input.name,
      examDate: new Date(input.examDate),
      startTime: input.startTime,
      endTime: input.endTime,
      classroomId: input.classroomId ?? null,
      maxMarks: input.maxMarks,
    },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "exam.create",
    entityType: "Exam",
    entityId: exam.id,
    summary: `${input.name} (${input.maxMarks} marks)`,
  });
  return exam;
}

/** Faculty view: marks for one exam they own. */
export async function getExamMarks(actor: Actor, examId: string) {
  const { exam, offering } = await facultyForExam(examId);
  if (!offering) throw new NotFoundError("No offering found for this exam.");
  authorize(actor, "marks:enter", { assignedFacultyId: offering.facultyId });

  const students = await prisma.studentProfile.findMany({
    where: { batchId: exam.batchId },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { rollNo: "asc" },
  });
  const marks = await prisma.markEntry.findMany({ where: { examId } });
  const map = new Map(marks.map((m) => [m.studentId, m.marks]));
  return {
    exam,
    students: students.map((s) => ({
      studentId: s.id,
      rollNo: s.rollNo,
      name: `${s.user.firstName} ${s.user.lastName}`,
      marks: map.get(s.id) ?? null,
    })),
  };
}
