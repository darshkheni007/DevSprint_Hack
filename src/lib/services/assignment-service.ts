import { prisma } from "../db";
import { writeAudit } from "../audit";
import { notifyUsers } from "../notifications";
import { NotFoundError, ValidationError } from "../errors";
import { Actor, authorize } from "../permissions";
import type { AssignmentInput } from "../validation";

/** Faculty creates an assignment for one of their offerings (M03-R05). */
export async function createAssignment(actor: Actor, input: AssignmentInput) {
  const offering = await prisma.subjectOffering.findUnique({
    where: { id: input.offeringId },
    include: { subject: true, batch: true },
  });
  if (!offering) throw new NotFoundError("Subject offering not found.");
  authorize(actor, "assignment:create", { assignedFacultyId: offering.facultyId });

  const deadline = new Date(input.deadline);
  if (Number.isNaN(deadline.getTime())) {
    throw new ValidationError("Please provide a valid deadline.");
  }
  if (deadline.getTime() <= Date.now()) {
    throw new ValidationError("The deadline must be in the future.");
  }

  const assignment = await prisma.assignment.create({
    data: {
      offeringId: offering.id,
      title: input.title,
      description: input.description,
      deadline,
      maxMarks: input.maxMarks,
      createdById: actor.id,
    },
  });

  const students = await prisma.studentProfile.findMany({
    where: { batchId: offering.batchId },
    select: { userId: true },
  });
  await notifyUsers(
    students.map((s) => s.userId),
    {
      type: "ASSIGNMENT_DEADLINE",
      title: "New assignment",
      body: `${offering.subject.code}: ${input.title}`,
      link: "/student/assignments",
      idempotencyKey: `assignment:new:${assignment.id}`,
    },
  );

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "assignment.create",
    entityType: "Assignment",
    entityId: assignment.id,
    summary: `Created assignment "${input.title}" for ${offering.batch.name}`,
  });
  return assignment;
}

export interface AssignmentView {
  id: string;
  title: string;
  description: string;
  deadline: Date;
  maxMarks: number;
  subjectCode: string;
  subjectName: string;
  batchName: string;
  facultyName: string;
}

/** Assignments visible to the actor (students: own batch; faculty: own). */
export async function listAssignments(actor: Actor): Promise<AssignmentView[]> {
  const where =
    actor.role === "STUDENT"
      ? { offering: { batchId: actor.batchId ?? "__none__" } }
      : actor.role === "FACULTY"
        ? { offering: { facultyId: actor.id } }
        : {};
  const rows = await prisma.assignment.findMany({
    where,
    include: {
      offering: {
        include: { subject: true, batch: true, faculty: true },
      },
    },
    orderBy: { deadline: "asc" },
  });
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    deadline: a.deadline,
    maxMarks: a.maxMarks,
    subjectCode: a.offering.subject.code,
    subjectName: a.offering.subject.name,
    batchName: a.offering.batch.name,
    facultyName: `${a.offering.faculty.firstName} ${a.offering.faculty.lastName}`,
  }));
}

/** Faculty's own offerings, for building assignment/attendance forms. */
export async function listMyOfferings(actor: Actor) {
  if (actor.role !== "FACULTY") return [];
  return prisma.subjectOffering.findMany({
    where: { facultyId: actor.id },
    include: { subject: true, batch: true },
    orderBy: { subject: { code: "asc" } },
  });
}
