import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { writeAudit } from "../audit";
import { notifyUsers } from "../notifications";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { Actor, authorize } from "../permissions";
import { DAYS } from "../constants";
import { buildSolverInput } from "./timetable-service";
import { validateSchedule } from "../timetable/validator";
import { buildSwappedAssignments, occupySameTime } from "../timetable/swap";
import type { SwapRequestInput, SwapDecisionInput } from "../validation";

/**
 * Faculty-to-faculty lecture swaps (persisted workflow).
 *
 * A swap exchanges the time position (day + periodIndex) of two PUBLISHED slots
 * owned by two different faculty. Both faculty must consent. The full
 * hypothetical timetable is re-validated inside the applying transaction, so a
 * conflicting swap leaves the published timetable untouched.
 */

function dayLabel(day: number): string {
  return DAYS.find((d) => d.value === day)?.short ?? `D${day}`;
}

function slotLabel(s: {
  day: number;
  periodIndex: number;
  offering: { subject: { code: string; name: string } };
  classroom: { code: string };
}): string {
  return `${s.offering.subject.code} ${s.offering.subject.name} · ${dayLabel(s.day)} P${s.periodIndex} · ${s.classroom.code}`;
}

function isP2002(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const slotInclude = {
  version: true,
  classroom: true,
  batch: true,
  offering: {
    include: { subject: true, faculty: { select: { id: true, firstName: true, lastName: true } } },
  },
} as const;

type SlotRow = Prisma.TimetableSlotGetPayload<{ include: typeof slotInclude }>;

async function loadSlot(slotId: string): Promise<SlotRow | null> {
  return prisma.timetableSlot.findUnique({ where: { id: slotId }, include: slotInclude });
}

/** The acting faculty's own published lectures (candidates to move). */
export async function listMyPublishedSlots(actor: Actor) {
  authorize(actor, "swap:read");
  if (actor.role !== "FACULTY") return [];
  const slots = await prisma.timetableSlot.findMany({
    where: { facultyId: actor.id, version: { status: "PUBLISHED" } },
    include: slotInclude,
    orderBy: [{ day: "asc" }, { periodIndex: "asc" }],
  });
  return slots.map((s) => ({
    id: s.id,
    label: slotLabel(s),
    day: s.day,
    periodIndex: s.periodIndex,
    subjectCode: s.offering.subject.code,
    subject: s.offering.subject.name,
    classroom: s.classroom.code,
    batchName: s.batch.name,
  }));
}

/** Other faculty's published lectures (candidates to swap with). */
export async function listPeerPublishedSlots(actor: Actor) {
  authorize(actor, "swap:read");
  if (actor.role !== "FACULTY") return [];
  const slots = await prisma.timetableSlot.findMany({
    where: { facultyId: { not: actor.id }, version: { status: "PUBLISHED" } },
    include: slotInclude,
    orderBy: [{ day: "asc" }, { periodIndex: "asc" }],
  });
  return slots.map((s) => ({
    id: s.id,
    label: `${slotLabel(s)} · ${s.offering.faculty.firstName} ${s.offering.faculty.lastName}`,
    facultyId: s.offering.facultyId,
    facultyName: `${s.offering.faculty.firstName} ${s.offering.faculty.lastName}`,
  }));
}

interface SwapRow {
  id: string;
  status: string;
  reason: string | null;
  failureReason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  finalizedAt: Date | null;
  requester: { id: string; firstName: string; lastName: string };
  recipient: { id: string; firstName: string; lastName: string };
  requesterSlot: {
    day: number;
    periodIndex: number;
    classroom: { code: string };
    offering: { subject: { code: string; name: string } };
    batch: { name: string };
  };
  recipientSlot: {
    day: number;
    periodIndex: number;
    classroom: { code: string };
    offering: { subject: { code: string; name: string } };
    batch: { name: string };
  };
}

const swapInclude = {
  requester: { select: { id: true, firstName: true, lastName: true } },
  recipient: { select: { id: true, firstName: true, lastName: true } },
  requesterSlot: {
    include: {
      classroom: true,
      batch: true,
      offering: { include: { subject: true } },
    },
  },
  recipientSlot: {
    include: {
      classroom: true,
      batch: true,
      offering: { include: { subject: true } },
    },
  },
} as const;

function presentSwap(row: SwapRow, actor: Actor) {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    finalizedAt: row.finalizedAt,
    requesterName: `${row.requester.firstName} ${row.requester.lastName}`,
    recipientName: `${row.recipient.firstName} ${row.recipient.lastName}`,
    requesterSlot: {
      label: slotLabel(row.requesterSlot),
      batchName: row.requesterSlot.batch.name,
    },
    recipientSlot: {
      label: slotLabel(row.recipientSlot),
      batchName: row.recipientSlot.batch.name,
    },
    // Only the nominated recipient, while still pending, may decide.
    canDecide: row.recipient.id === actor.id && row.status === "PENDING",
    canCancel: row.requester.id === actor.id && row.status === "PENDING",
  };
}

export async function listOutgoingSwaps(actor: Actor) {
  authorize(actor, "swap:read");
  if (actor.role !== "FACULTY") return [];
  const rows = (await prisma.lectureSwapRequest.findMany({
    where: { requesterId: actor.id },
    include: swapInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  })) as unknown as SwapRow[];
  return rows.map((r) => presentSwap(r, actor));
}

export async function listIncomingSwaps(actor: Actor) {
  authorize(actor, "swap:read");
  if (actor.role !== "FACULTY") return [];
  const rows = (await prisma.lectureSwapRequest.findMany({
    where: { recipientId: actor.id },
    include: swapInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  })) as unknown as SwapRow[];
  return rows.map((r) => presentSwap(r, actor));
}

/** Create a swap request (this is the requester's explicit consent). */
export async function createSwapRequest(actor: Actor, input: SwapRequestInput) {
  authorize(actor, "swap:request");
  if (actor.role !== "FACULTY") {
    throw new ForbiddenError("Only faculty members can request lecture swaps.");
  }

  const [requesterSlot, recipientSlot] = await Promise.all([
    loadSlot(input.requesterSlotId),
    loadSlot(input.recipientSlotId),
  ]);
  if (!requesterSlot) throw new NotFoundError("Your lecture could not be found.");
  if (!recipientSlot) throw new NotFoundError("The selected lecture could not be found.");

  if (requesterSlot.facultyId !== actor.id) {
    throw new ForbiddenError("You can only request a swap for your own lecture.");
  }
  if (recipientSlot.facultyId === actor.id) {
    throw new ValidationError("You cannot request a swap with yourself.", {
      recipientSlotId: ["Choose another faculty member's lecture."],
    });
  }
  if (
    requesterSlot.version.status !== "PUBLISHED" ||
    recipientSlot.version.status !== "PUBLISHED"
  ) {
    throw new ConflictError("Only lectures on the published timetable can be swapped.");
  }
  if (requesterSlot.versionId !== recipientSlot.versionId) {
    throw new ValidationError("Both lectures must belong to the same published timetable.", {
      recipientSlotId: ["Choose a lecture from the current published timetable."],
    });
  }
  if (occupySameTime(requesterSlot, recipientSlot)) {
    throw new ValidationError("The two lectures already occupy the same time slot.", {
      recipientSlotId: ["Choose a lecture at a different time."],
    });
  }

  const duplicate = await prisma.lectureSwapRequest.findFirst({
    where: {
      requesterSlotId: requesterSlot.id,
      recipientSlotId: recipientSlot.id,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("An identical swap request is already pending.");
  }

  let request;
  try {
    request = await prisma.lectureSwapRequest.create({
      data: {
        versionId: requesterSlot.versionId,
        requesterId: actor.id,
        recipientId: recipientSlot.facultyId,
        requesterSlotId: requesterSlot.id,
        recipientSlotId: recipientSlot.id,
        reason: input.reason?.trim() || null,
        status: "PENDING",
        requesterApproved: true,
        recipientApproved: false,
      },
    });
  } catch (error) {
    if (isP2002(error)) throw new ConflictError("An identical swap request already exists.");
    throw error;
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "swap.requested",
    entityType: "LectureSwapRequest",
    entityId: request.id,
    summary: `Requested swap of "${slotLabel(requesterSlot)}" with recipient ${recipientSlot.facultyId}`,
  });

  await notifyUsers([recipientSlot.facultyId], {
    type: "LECTURE_SWAP",
    title: "Lecture swap request",
    body: `${actor.name} requested to swap "${slotLabel(requesterSlot)}" with your "${slotLabel(recipientSlot)}".`,
    link: "/faculty/swaps",
    idempotencyKey: `swap:requested:${request.id}`,
  });

  return { id: request.id, status: request.status };
}

/** Reject a pending request (recipient only). Timetable is never touched. */
async function rejectSwap(actor: Actor, requestId: string) {
  const request = await prisma.lectureSwapRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Swap request not found.");
  authorize(actor, "swap:respond", { ownerUserId: request.recipientId });

  // Compare-and-set: only a still-pending request can be decided once.
  const claimed = await prisma.lectureSwapRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "REJECTED", recipientApproved: false, decidedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new ConflictError("This request has already been decided.");
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "swap.rejected",
    entityType: "LectureSwapRequest",
    entityId: requestId,
    summary: "Recipient rejected the swap; timetable unchanged",
    result: "DENIED",
  });
  await notifyUsers([request.requesterId], {
    type: "LECTURE_SWAP",
    title: "Lecture swap declined",
    body: `${actor.name} declined your lecture swap request. The timetable is unchanged.`,
    link: "/faculty/swaps",
    idempotencyKey: `swap:rejected:${requestId}`,
  });
  return { status: "REJECTED" };
}

/**
 * Apply an ACCEPTED swap inside a single transaction: re-validate the whole
 * hypothetical timetable, then exchange the two positions via a temporary cell
 * so the three per-version unique guards are never transiently violated.
 */
async function applySwap(requestId: string) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const request = await tx.lectureSwapRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundError("Swap request not found.");
        if (request.status !== "ACCEPTED" || !request.requesterApproved || !request.recipientApproved) {
          throw new ConflictError("Both faculty members must approve before the swap is applied.");
        }

        const version = await tx.timetableVersion.findUnique({ where: { id: request.versionId } });
        if (!version) throw new NotFoundError("Timetable version not found.");
        if (version.status !== "PUBLISHED") {
          throw new ConflictError("The timetable is no longer published; the swap was not applied.");
        }

        const slots = await tx.timetableSlot.findMany({ where: { versionId: request.versionId } });
        const a = slots.find((s) => s.id === request.requesterSlotId);
        const b = slots.find((s) => s.id === request.recipientSlotId);
        if (!a || !b) throw new NotFoundError("One of the lectures no longer exists.");
        if (a.facultyId !== request.requesterId || b.facultyId !== request.recipientId) {
          throw new ConflictError("Lecture ownership changed; the swap is no longer valid.");
        }

        const input = await buildSolverInput(version.termId, tx);
        const hypothetical = buildSwappedAssignments(
          slots,
          request.requesterSlotId,
          request.recipientSlotId,
        );
        const result = validateSchedule(input, hypothetical);
        if (!result.valid) {
          throw new ConflictError(
            `The swap would create a conflict: ${result.violations[0]?.message ?? "invalid schedule"}`,
          );
        }

        // Temporary cell (day 0 is outside the Mon–Sat domain, so it is free),
        // then move b and finally a into their exchanged positions.
        await tx.timetableSlot.update({
          where: { id: a.id },
          data: { day: 0, periodIndex: 0 },
        });
        await tx.timetableSlot.update({
          where: { id: b.id },
          data: { day: a.day, periodIndex: a.periodIndex },
        });
        await tx.timetableSlot.update({
          where: { id: a.id },
          data: { day: b.day, periodIndex: b.periodIndex },
        });

        const finalized = await tx.lectureSwapRequest.updateMany({
          where: { id: requestId, status: "ACCEPTED" },
          data: { status: "FINALIZED", finalizedAt: new Date() },
        });
        if (finalized.count !== 1) {
          throw new ConflictError("The swap was finalised concurrently.");
        }

        return {
          requesterId: request.requesterId,
          recipientId: request.recipientId,
          requesterBatchId: a.batchId,
          recipientBatchId: b.batchId,
        };
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (isP2002(error)) {
      throw new ConflictError(
        "The swap could not be applied because it would double-book a faculty member, classroom or batch.",
      );
    }
    throw error;
  }
}

/** Accept (recipient only): record consent, then attempt to finalise. */
async function acceptSwap(actor: Actor, requestId: string) {
  const request = await prisma.lectureSwapRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Swap request not found.");
  authorize(actor, "swap:respond", { ownerUserId: request.recipientId });

  const claimed = await prisma.lectureSwapRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "ACCEPTED", recipientApproved: true, decidedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new ConflictError("This request has already been decided.");
  }

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "swap.accepted",
    entityType: "LectureSwapRequest",
    entityId: requestId,
    summary: "Recipient accepted the swap request",
  });
  await notifyUsers([request.requesterId], {
    type: "LECTURE_SWAP",
    title: "Lecture swap accepted",
    body: `${actor.name} accepted your swap request. Applying the timetable change now.`,
    link: "/faculty/swaps",
    idempotencyKey: `swap:accepted:${requestId}`,
  });

  try {
    const applied = await applySwap(requestId);
    await writeAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "swap.finalized",
      entityType: "LectureSwapRequest",
      entityId: requestId,
      summary: "Swap finalised; both faculty consented and the timetable was updated",
    });
    await notifyUsers([applied.requesterId, applied.recipientId], {
      type: "LECTURE_SWAP",
      title: "Lecture swap completed",
      body: "The agreed lecture swap has been applied to the published timetable.",
      link: "/faculty/timetable",
      idempotencyKey: `swap:finalized:faculty:${requestId}`,
    });
    const students = await prisma.studentProfile.findMany({
      where: { batchId: { in: [applied.requesterBatchId, applied.recipientBatchId] } },
      select: { userId: true },
    });
    await notifyUsers(
      students.map((s) => s.userId),
      {
        type: "TIMETABLE_CHANGED",
        title: "Timetable change",
        body: "A lecture in your timetable has moved. Please check your updated timetable.",
        link: "/student/timetable",
        idempotencyKey: `swap:finalized:students:${requestId}`,
      },
    );
    return { status: "FINALIZED" as const };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "The swap could not be applied.";
    await prisma.lectureSwapRequest.update({
      where: { id: requestId },
      data: { status: "FAILED", failureReason: reason },
    });
    await writeAudit({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "swap.finalize.failed",
      entityType: "LectureSwapRequest",
      entityId: requestId,
      summary: reason,
      result: "FAILURE",
    });
    await notifyUsers([request.requesterId], {
      type: "LECTURE_SWAP",
      title: "Lecture swap could not be applied",
      body: reason,
      link: "/faculty/swaps",
      idempotencyKey: `swap:failed:${requestId}`,
    });
    throw error;
  }
}

/** Recipient accepts or rejects. Only the recipient may call this. */
export async function decideSwap(actor: Actor, input: SwapDecisionInput) {
  if (input.decision === "REJECT") {
    return rejectSwap(actor, input.requestId);
  }
  return acceptSwap(actor, input.requestId);
}

/** Requester withdraws a still-pending request. */
export async function cancelSwapRequest(actor: Actor, requestId: string) {
  const request = await prisma.lectureSwapRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Swap request not found.");
  if (request.requesterId !== actor.id) {
    throw new ForbiddenError("You can only withdraw your own swap request.");
  }
  const claimed = await prisma.lectureSwapRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (claimed.count !== 1) {
    throw new ConflictError("Only a pending request can be withdrawn.");
  }
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "swap.withdrawn",
    entityType: "LectureSwapRequest",
    entityId: requestId,
    summary: "Requester withdrew the swap request",
  });
  await notifyUsers([request.recipientId], {
    type: "LECTURE_SWAP",
    title: "Lecture swap withdrawn",
    body: `${actor.name} withdrew a swap request.`,
    link: "/faculty/swaps",
    idempotencyKey: `swap:withdrawn:${requestId}`,
  });
  return { status: "CANCELLED" as const };
}
