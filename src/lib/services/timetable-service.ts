import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "../audit";
import { notifyUsers } from "../notifications";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { Actor, authorize } from "../permissions";
import {
  DAYS,
  DEFAULT_PERIODS,
  TimetableStatus,
  TIMETABLE_TRANSITIONS,
} from "../constants";
import { solve, SolverInput, SolverRoom, SolverTask } from "../timetable/solver";
import { validateSchedule } from "../timetable/validator";

const DAY_VALUES = DAYS.map((d) => d.value);
const PERIOD_VALUES = DEFAULT_PERIODS.map((p) => p.index);

/**
 * Assemble the solver input from persisted data for a term.
 *
 * `client` lets callers read through the SAME connection as an interactive
 * transaction (never run these reads on the global client inside a tx).
 */
export async function buildSolverInput(
  termId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<SolverInput> {
  const offerings = await client.subjectOffering.findMany({
    where: { termId },
    include: {
      subject: true,
      batch: true,
      faculty: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const tasks: SolverTask[] = offerings.map((o) => ({
    offeringId: o.id,
    subjectLabel: `${o.subject.code} ${o.subject.name}`,
    batchId: o.batchId,
    batchStrength: o.batch.strength,
    facultyId: o.facultyId,
    facultyName: `${o.faculty.firstName} ${o.faculty.lastName}`,
    isLab: o.subject.isLab,
    sessions: o.weeklySessions,
  }));

  const classrooms = await client.classroom.findMany({ orderBy: { code: "asc" } });
  const rooms: SolverRoom[] = classrooms.map((c) => ({
    id: c.id,
    code: c.code,
    capacity: c.capacity,
    type: c.type === "LAB" ? "LAB" : "LECTURE",
  }));

  const availabilityRows = await client.facultyAvailability.findMany({
    where: { available: false },
  });
  const availability = new Map<string, Set<string>>();
  // Only faculty that have ANY restriction row are constrained. We treat the
  // full grid as allowed and remove the unavailable slots.
  const restrictedFaculty = new Set(availabilityRows.map((r) => r.facultyId));
  for (const facultyId of restrictedFaculty) {
    const allowed = new Set<string>();
    for (const day of DAY_VALUES) {
      for (const period of PERIOD_VALUES) {
        allowed.add(`${day}:${period}`);
      }
    }
    availability.set(facultyId, allowed);
  }
  for (const row of availabilityRows) {
    availability.get(row.facultyId)?.delete(`${row.day}:${row.periodIndex}`);
  }

  return { tasks, rooms, days: DAY_VALUES, periods: PERIOD_VALUES, availability };
}

export interface GenerateResult {
  versionId: string | null;
  satisfied: boolean;
  conflicts: { subjectLabel: string; message: string; suggestion: string }[];
  score: { idleGaps: number; workloadImbalance: number };
  placed: number;
}

/** M05-R01: generate a draft timetable. Never publishes. */
export async function generateTimetable(
  actor: Actor,
  termId: string,
): Promise<GenerateResult> {
  authorize(actor, "timetable:generate");

  const term = await prisma.academicTerm.findUnique({ where: { id: termId } });
  if (!term) throw new NotFoundError("Academic term not found.");

  const input = await buildSolverInput(termId);
  if (input.tasks.length === 0) {
    throw new ValidationError(
      "No subject offerings exist for this term, so there is nothing to schedule.",
    );
  }

  const result = solve(input);
  const validation = validateSchedule(input, result.assignments);
  if (!validation.valid) {
    // The solver should never produce this; surface it rather than persist.
    throw new ConflictError(
      "Generation produced an invalid schedule and was rejected. Please review the constraints.",
    );
  }

  const last = await prisma.timetableVersion.findFirst({
    where: { termId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  const version = await prisma.timetableVersion.create({
    data: {
      termId,
      versionNumber,
      status: "GENERATED",
      createdById: actor.id,
      diagnostics:
        result.conflicts.length > 0 ? JSON.stringify(result.conflicts) : null,
      slots: {
        create: result.assignments.map((a) => ({
          offeringId: a.offeringId,
          classroomId: a.classroomId,
          facultyId: a.facultyId,
          batchId: a.batchId,
          day: a.day,
          periodIndex: a.periodIndex,
          slotType: a.slotType,
        })),
      },
    },
  });

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "timetable.generate",
    entityType: "TimetableVersion",
    entityId: version.id,
    summary: `Generated v${versionNumber}: ${result.assignments.length} slots, ${result.conflicts.length} conflicts`,
    result: "SUCCESS",
  });

  return {
    versionId: version.id,
    satisfied: result.satisfied,
    conflicts: result.conflicts.map((c) => ({
      subjectLabel: c.subjectLabel,
      message: c.message,
      suggestion: c.suggestion,
    })),
    score: result.score,
    placed: result.assignments.length,
  };
}

/** Re-derive hard constraints for a stored version (independent validator). */
export async function validateVersion(
  versionId: string,
  client: Prisma.TransactionClient = prisma,
) {
  const version = await client.timetableVersion.findUnique({
    where: { id: versionId },
    include: { slots: true },
  });
  if (!version) throw new NotFoundError("Timetable version not found.");
  const input = await buildSolverInput(version.termId, client);
  const result = validateSchedule(
    input,
    version.slots.map((s) => ({
      offeringId: s.offeringId,
      batchId: s.batchId,
      facultyId: s.facultyId,
      classroomId: s.classroomId,
      day: s.day,
      periodIndex: s.periodIndex,
      slotType: s.slotType === "LAB" ? "LAB" : "LECTURE",
    })),
  );
  return { version, input, ...result };
}

async function transition(
  actor: Actor,
  versionId: string,
  next: TimetableStatus,
) {
  const version = await prisma.timetableVersion.findUnique({
    where: { id: versionId },
  });
  if (!version) throw new NotFoundError("Timetable version not found.");
  const current = version.status as TimetableStatus;
  if (!TIMETABLE_TRANSITIONS[current].includes(next)) {
    throw new ConflictError(
      `Cannot move a timetable from ${current} to ${next}.`,
    );
  }
  return version;
}

export async function submitForReview(actor: Actor, versionId: string) {
  authorize(actor, "timetable:edit");
  await transition(actor, versionId, "IN_REVIEW");
  await prisma.timetableVersion.update({
    where: { id: versionId },
    data: { status: "IN_REVIEW" },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "timetable.review",
    entityType: "TimetableVersion",
    entityId: versionId,
    summary: "Submitted for admin review",
  });
}

export async function approveTimetable(actor: Actor, versionId: string) {
  authorize(actor, "timetable:approve");
  await transition(actor, versionId, "APPROVED");
  const validation = await validateVersion(versionId);
  if (!validation.valid) {
    throw new ConflictError(
      "This timetable has unresolved conflicts and cannot be approved.",
    );
  }
  await prisma.timetableVersion.update({
    where: { id: versionId },
    data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date() },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "timetable.approve",
    entityType: "TimetableVersion",
    entityId: versionId,
    summary: "Approved by admin",
  });
}

/**
 * M05-R11 / SEC-Z05: publication requires Admin AND APPROVED status. The state
 * machine rejects any other transition, so a generated timetable can never be
 * auto-published.
 */
export async function publishTimetable(actor: Actor, versionId: string) {
  authorize(actor, "timetable:publish");
  const version = await transition(actor, versionId, "PUBLISHED");
  if (version.status !== "APPROVED") {
    // Explicit belt-and-braces check in addition to the transition table.
    throw new ForbiddenError(
      "A timetable can only be published once it has been approved.",
    );
  }
  const validation = await validateVersion(versionId);
  if (!validation.valid) {
    throw new ConflictError("Cannot publish a timetable with conflicts.");
  }

  // Archive any previously published version for this term.
  await prisma.timetableVersion.updateMany({
    where: {
      termId: version.termId,
      status: "PUBLISHED",
      id: { not: versionId },
    },
    data: { status: "ARCHIVED" },
  });

  await prisma.timetableVersion.update({
    where: { id: versionId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  // Notify only affected faculty and students (M05-R12).
  const slots = await prisma.timetableSlot.findMany({
    where: { versionId },
    select: { facultyId: true, batchId: true },
  });
  const facultyIds = Array.from(new Set(slots.map((s) => s.facultyId)));
  const batchIds = Array.from(new Set(slots.map((s) => s.batchId)));
  const students = await prisma.studentProfile.findMany({
    where: { batchId: { in: batchIds } },
    select: { userId: true },
  });
  const studentIds = students.map((s) => s.userId);

  await notifyUsers([...facultyIds, ...studentIds], {
    type: "TIMETABLE_PUBLISHED",
    title: "Timetable published",
    body: "A new timetable has been approved and published for your classes.",
    link: "/timetable",
    idempotencyKey: `timetable:published:${versionId}`,
  });

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "timetable.publish",
    entityType: "TimetableVersion",
    entityId: versionId,
    summary: `Published v${version.versionNumber}; notified ${facultyIds.length} faculty and ${studentIds.length} students`,
  });
}

/** Manual edit of a slot; re-validated and rejected on conflict (M05-R09). */
export async function editSlot(
  actor: Actor,
  params: {
    versionId: string;
    slotId: string;
    day: number;
    periodIndex: number;
    classroomId?: string;
  },
) {
  authorize(actor, "timetable:edit");
  const version = await prisma.timetableVersion.findUnique({
    where: { id: params.versionId },
  });
  if (!version) throw new NotFoundError("Timetable version not found.");
  if (version.status === "PUBLISHED" || version.status === "ARCHIVED") {
    throw new ConflictError("Published or archived timetables cannot be edited.");
  }
  const slot = await prisma.timetableSlot.findUnique({
    where: { id: params.slotId },
  });
  if (!slot || slot.versionId !== params.versionId) {
    throw new NotFoundError("Slot not found in this timetable.");
  }

  await prisma.timetableSlot.update({
    where: { id: params.slotId },
    data: {
      day: params.day,
      periodIndex: params.periodIndex,
      ...(params.classroomId ? { classroomId: params.classroomId } : {}),
    },
  });

  const validation = await validateVersion(params.versionId);
  if (!validation.valid) {
    // Roll back the edit that introduced the conflict.
    await prisma.timetableSlot.update({
      where: { id: params.slotId },
      data: {
        day: slot.day,
        periodIndex: slot.periodIndex,
        classroomId: slot.classroomId,
      },
    });
    throw new ConflictError(
      `Edit rejected: ${validation.violations[0]?.message ?? "it would create a conflict."}`,
    );
  }

  await prisma.timetableVersion.update({
    where: { id: params.versionId },
    data: { status: version.status === "GENERATED" ? "IN_REVIEW" : version.status },
  });

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "timetable.edit",
    entityType: "TimetableSlot",
    entityId: params.slotId,
    summary: `Moved slot to day ${params.day} period ${params.periodIndex}`,
  });
}

export interface TimetableCell {
  slotId: string;
  day: number;
  periodIndex: number;
  subject: string;
  subjectCode: string;
  facultyName: string;
  classroom: string;
  classroomId: string;
  batchId: string;
  batchName: string;
  slotType: string;
  /** True when this slot has at least one cancelled occurrence. */
  cancelled: boolean;
}

/** Slot ids (from the given set) that have at least one cancelled lecture date. */
async function cancelledSlotIds(
  slotIds: string[],
  client: Prisma.TransactionClient = prisma,
): Promise<Set<string>> {
  if (slotIds.length === 0) return new Set();
  const rows = await client.lectureCancellation.findMany({
    where: { slotId: { in: slotIds } },
    select: { slotId: true },
  });
  return new Set(rows.map((r) => r.slotId));
}

export async function getVersionGrid(versionId: string): Promise<TimetableCell[]> {
  const slots = await prisma.timetableSlot.findMany({
    where: { versionId },
    include: {
      offering: { include: { subject: true, faculty: true } },
      classroom: true,
      batch: true,
    },
    orderBy: [{ day: "asc" }, { periodIndex: "asc" }],
  });
  const cancelled = await cancelledSlotIds(slots.map((s) => s.id));
  return slots.map((s) => ({
    slotId: s.id,
    day: s.day,
    periodIndex: s.periodIndex,
    subject: s.offering.subject.name,
    subjectCode: s.offering.subject.code,
    facultyName: `${s.offering.faculty.firstName} ${s.offering.faculty.lastName}`,
    classroom: s.classroom.code,
    classroomId: s.classroomId,
    batchId: s.batchId,
    batchName: s.batch.name,
    slotType: s.slotType,
    cancelled: cancelled.has(s.id),
  }));
}

export async function listVersions(actor: Actor, termId: string) {
  authorize(actor, "timetable:read");
  return prisma.timetableVersion.findMany({
    where: { termId },
    orderBy: { versionNumber: "desc" },
    include: { slots: { select: { id: true } } },
  });
}

export async function getPublishedVersionForBatch(batchId: string) {
  return prisma.timetableVersion.findFirst({
    where: { status: "PUBLISHED", slots: { some: { batchId } } },
    orderBy: { versionNumber: "desc" },
  });
}

/** Faculty's own published teaching slots (SEC-Z06: published only, own rows). */
export async function getFacultyTimetable(actor: Actor): Promise<TimetableCell[]> {
  authorize(actor, "timetable:read", {
    assignedFacultyId: actor.id,
    isPublished: true,
  });
  const slots = await prisma.timetableSlot.findMany({
    where: { facultyId: actor.id, version: { status: "PUBLISHED" } },
    include: {
      offering: { include: { subject: true, faculty: true } },
      classroom: true,
      batch: true,
    },
    orderBy: [{ day: "asc" }, { periodIndex: "asc" }],
  });
  const cancelled = await cancelledSlotIds(slots.map((s) => s.id));
  return slots.map((s) => ({
    slotId: s.id,
    day: s.day,
    periodIndex: s.periodIndex,
    subject: s.offering.subject.name,
    subjectCode: s.offering.subject.code,
    facultyName: `${s.offering.faculty.firstName} ${s.offering.faculty.lastName}`,
    classroom: s.classroom.code,
    classroomId: s.classroomId,
    batchId: s.batchId,
    batchName: s.batch.name,
    slotType: s.slotType,
    cancelled: cancelled.has(s.id),
  }));
}

/** Student's own batch published timetable (SEC-Z02/Z06). */
export async function getStudentTimetable(
  actor: Actor,
): Promise<{ batchId: string | null; cells: TimetableCell[] }> {
  if (actor.role !== "STUDENT" || !actor.batchId) return { batchId: null, cells: [] };
  authorize(actor, "timetable:read", {
    assignedBatchId: actor.batchId,
    isPublished: true,
  });
  const slots = await prisma.timetableSlot.findMany({
    where: { batchId: actor.batchId, version: { status: "PUBLISHED" } },
    include: {
      offering: { include: { subject: true, faculty: true } },
      classroom: true,
      batch: true,
    },
    orderBy: [{ day: "asc" }, { periodIndex: "asc" }],
  });
  const cancelled = await cancelledSlotIds(slots.map((s) => s.id));
  return {
    batchId: actor.batchId,
    cells: slots.map((s) => ({
      slotId: s.id,
      day: s.day,
      periodIndex: s.periodIndex,
      subject: s.offering.subject.name,
      subjectCode: s.offering.subject.code,
      facultyName: `${s.offering.faculty.firstName} ${s.offering.faculty.lastName}`,
      classroom: s.classroom.code,
      classroomId: s.classroomId,
      batchId: s.batchId,
      batchName: s.batch.name,
      slotType: s.slotType,
      cancelled: cancelled.has(s.id),
    })),
  };
}
