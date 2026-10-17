import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { writeAudit } from "../audit";
import { notifyUsers } from "../notifications";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { Actor, authorize } from "../permissions";
import { DAYS } from "../constants";
import { dateKey, parseDateKey, utcMidnight, weekdayNumber } from "../timetable/occurrence";
import type { LectureCancellationInput } from "../validation";

/**
 * Date-specific lecture cancellation (persisted, idempotent).
 *
 * Cancelling affects a single occurrence — the (slot, date) pair — never the
 * whole recurring slot and never the class-session / attendance / marks history.
 */

function isP2002(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const cancelSlotInclude = {
  version: true,
  classroom: true,
  batch: true,
  offering: { include: { subject: true, faculty: { select: { id: true, firstName: true, lastName: true } } } },
} as const;

/**
 * Slots the actor may cancel: own published slots for faculty, all published
 * slots for an administrator. Role check is explicit (a read, not a mutation).
 */
export async function listCancellableSlots(actor: Actor) {
  if (actor.role !== "FACULTY" && actor.role !== "ADMIN") return [];
  const where =
    actor.role === "FACULTY"
      ? { version: { status: "PUBLISHED" }, offering: { facultyId: actor.id } }
      : { version: { status: "PUBLISHED" } };
  const slots = await prisma.timetableSlot.findMany({
    where,
    include: cancelSlotInclude,
    orderBy: [{ day: "asc" }, { periodIndex: "asc" }],
    take: 200,
  });
  return slots.map((s) => ({
    id: s.id,
    label: `${s.offering.subject.code} ${s.offering.subject.name} · ${DAYS.find((d) => d.value === s.day)?.label ?? ""} P${s.periodIndex} · ${s.batch.name} · ${s.classroom.code}`,
    day: s.day,
  }));
}

const cancellationInclude = {
  cancelledBy: { select: { firstName: true, lastName: true } },
  slot: {
    include: {
      classroom: true,
      batch: true,
      offering: { include: { subject: true } },
    },
  },
} as const;

function presentCancellation(
  row: Prisma.LectureCancellationGetPayload<{ include: typeof cancellationInclude }>,
) {
  return {
    id: row.id,
    date: dateKey(row.date),
    reason: row.reason,
    cancelledByName: `${row.cancelledBy.firstName} ${row.cancelledBy.lastName}`,
    day: row.slot.day,
    periodIndex: row.slot.periodIndex,
    subjectCode: row.slot.offering.subject.code,
    subject: row.slot.offering.subject.name,
    classroom: row.slot.classroom.code,
    batchName: row.slot.batch.name,
    slotId: row.slotId,
  };
}

/** Cancellations declared for the acting faculty's own published lectures. */
export async function listCancellationsForFaculty(actor: Actor) {
  if (actor.role !== "FACULTY") return [];
  const rows = await prisma.lectureCancellation.findMany({
    where: { slot: { version: { status: "PUBLISHED" }, offering: { facultyId: actor.id } } },
    include: cancellationInclude,
    orderBy: { date: "desc" },
    take: 100,
  });
  return rows.map(presentCancellation);
}

/** Cancellations affecting the acting student's batch (visible in their views). */
export async function listCancellationsForStudent(actor: Actor) {
  if (actor.role !== "STUDENT" || !actor.batchId) return [];
  const rows = await prisma.lectureCancellation.findMany({
    where: { slot: { batchId: actor.batchId, version: { status: "PUBLISHED" } } },
    include: cancellationInclude,
    orderBy: { date: "desc" },
    take: 100,
  });
  return rows.map(presentCancellation);
}

/**
 * Cancel one occurrence of a lecture. Idempotent: a repeated request returns the
 * existing cancellation and does not create duplicate notifications.
 */
export async function cancelLecture(actor: Actor, input: LectureCancellationInput) {
  const slot = await prisma.timetableSlot.findUnique({
    where: { id: input.slotId },
    include: cancelSlotInclude,
  });
  if (!slot) throw new NotFoundError("The selected lecture could not be found.");

  // Faculty may only cancel a lecture they are responsible for; admins may cancel any.
  authorize(actor, "lecture:cancel", { assignedFacultyId: slot.offering.facultyId });

  if (slot.version.status !== "PUBLISHED") {
    throw new ConflictError("Only lectures on the published timetable can be cancelled.");
  }

  let date: Date;
  try {
    date = parseDateKey(input.date);
  } catch {
    throw new ValidationError("Enter a valid cancellation date.", {
      date: ["Use the format YYYY-MM-DD."],
    });
  }

  const weekday = weekdayNumber(date);
  if (weekday < 1 || weekday > 6) {
    throw new ValidationError("Lectures are only scheduled Monday to Saturday.", {
      date: ["Choose a weekday lecture date."],
    });
  }
  if (weekday !== slot.day) {
    const expected = DAYS.find((d) => d.value === slot.day)?.label ?? "the scheduled day";
    throw new ValidationError(
      `That date is a ${DAYS.find((d) => d.value === weekday)?.label}, but this lecture runs on ${expected}.`,
      { date: [`Choose a ${expected}.`] },
    );
  }

  const term = await prisma.academicTerm.findUnique({ where: { id: slot.version.termId } });
  if (term) {
    const d = date.getTime();
    if (d < utcMidnight(term.startDate).getTime() || d > utcMidnight(term.endDate).getTime()) {
      throw new ValidationError("The date is outside the current academic term.", {
        date: ["Choose a date within the academic term."],
      });
    }
  }

  // Link to the existing class session for that date, when one exists.
  const existingSession = await prisma.classSession.findFirst({
    where: {
      slotId: slot.id,
      date: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });

  let duplicate = false;
  let cancellationId: string;
  try {
    const created = await prisma.lectureCancellation.create({
      data: {
        slotId: slot.id,
        classSessionId: existingSession?.id ?? null,
        date,
        cancelledById: actor.id,
        reason: input.reason?.trim() || null,
      },
      select: { id: true },
    });
    cancellationId = created.id;
  } catch (error) {
    if (!isP2002(error)) throw error;
    // Already cancelled for this date — find the existing row (idempotent retry).
    const existing = await prisma.lectureCancellation.findUnique({
      where: { slotId_date: { slotId: slot.id, date } },
      select: { id: true },
    });
    if (!existing) throw error;
    cancellationId = existing.id;
    duplicate = true;
  }

  const key = dateKey(date);
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: duplicate ? "lecture.cancel.duplicate" : "lecture.cancel",
    entityType: "LectureCancellation",
    entityId: cancellationId,
    summary: `Cancelled ${slot.offering.subject.code} on ${key} (P${slot.periodIndex})`,
  });

  // Notify affected students and the faculty teaching this batch. Idempotency
  // keys make repeated submissions safe (no duplicate notifications).
  const students = await prisma.studentProfile.findMany({
    where: { batchId: slot.batchId },
    select: { userId: true },
  });
  await notifyUsers(
    students.map((s) => s.userId),
    {
      type: "LECTURE_CANCELLED",
      title: "Lecture cancelled",
      body: `${slot.offering.subject.code} ${slot.offering.subject.name} on ${key} (P${slot.periodIndex}) is cancelled.${input.reason ? ` Reason: ${input.reason}` : ""}`,
      link: "/student/timetable",
      idempotencyKey: `lecture:cancelled:students:${slot.id}:${key}`,
    },
  );

  const batchFaculty = await prisma.subjectOffering.findMany({
    where: { batchId: slot.batchId, termId: slot.version.termId },
    select: { facultyId: true },
  });
  await notifyUsers(
    [slot.offering.facultyId, ...batchFaculty.map((f) => f.facultyId)],
    {
      type: "LECTURE_CANCELLED",
      title: "Lecture cancelled",
      body: `${slot.offering.subject.code} ${slot.offering.subject.name} on ${key} (P${slot.periodIndex}) has been cancelled.`,
      link: "/faculty/timetable",
      idempotencyKey: `lecture:cancelled:faculty:${slot.id}:${key}`,
    },
  );

  return { id: cancellationId, duplicate, date: key };
}
