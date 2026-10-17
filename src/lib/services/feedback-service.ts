import { prisma } from "../db";
import { writeAudit } from "../audit";
import { notifyUsers } from "../notifications";
import { NotFoundError } from "../errors";
import { Actor, authorize } from "../permissions";
import { z } from "zod";
import {
  complaintResponseSchema,
  complaintSchema,
  feedbackSchema,
} from "../validation";

/** Student submits faculty feedback (M10-R01). Admin-only visibility. */
export async function submitFeedback(
  actor: Actor,
  input: z.infer<typeof feedbackSchema>,
) {
  authorize(actor, "feedback:submit");
  const feedback = await prisma.feedback.create({
    data: {
      studentId: actor.id,
      facultyId: input.facultyId ?? null,
      subject: input.subject,
      message: input.message,
      isAnonymous: input.isAnonymous,
    },
  });
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "feedback.submit",
    entityType: "Feedback",
    entityId: feedback.id,
    summary: input.isAnonymous ? "Anonymous feedback submitted" : "Feedback submitted",
  });
  return feedback;
}

/** Student reports a campus issue (M10-R02) and Admins are notified (DEV-007). */
export async function submitComplaint(
  actor: Actor,
  input: z.infer<typeof complaintSchema>,
) {
  authorize(actor, "complaint:submit");
  const complaint = await prisma.complaint.create({
    data: {
      studentId: actor.id,
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: "SUBMITTED",
    },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await notifyUsers(
    admins.map((a) => a.id),
    {
      type: "COMPLAINT_NEW",
      title: "New complaint received",
      body: input.subject,
      link: "/admin/complaints",
      idempotencyKey: `complaint:new:${complaint.id}`,
    },
  );
  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "complaint.submit",
    entityType: "Complaint",
    entityId: complaint.id,
    summary: input.subject,
  });
  return complaint;
}

/** Student tracks only their own complaints (M10-R06, SEC-Z02). */
export async function listMyComplaints(actor: Actor) {
  return prisma.complaint.findMany({
    where: { studentId: actor.id },
    include: { responses: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Admin reviews all complaints and feedback (M10-R04, SEC). */
export async function listAllComplaints(actor: Actor) {
  authorize(actor, "complaint:manage");
  return prisma.complaint.findMany({
    include: {
      responses: { orderBy: { createdAt: "asc" }, include: { admin: true } },
      student: { select: { firstName: true, lastName: true, loginId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllFeedback(actor: Actor) {
  authorize(actor, "feedback:read:all");
  const rows = await prisma.feedback.findMany({
    include: { faculty: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // Anonymous feedback never exposes the submitter (M10-R07).
  return rows.map((f) => ({
    id: f.id,
    subject: f.subject,
    message: f.message,
    isAnonymous: f.isAnonymous,
    facultyName: f.faculty
      ? `${f.faculty.firstName} ${f.faculty.lastName}`
      : "General",
    createdAt: f.createdAt,
  }));
}

/** Admin responds and updates status (M10-R05); student is notified. */
export async function respondToComplaint(
  actor: Actor,
  input: z.infer<typeof complaintResponseSchema>,
) {
  authorize(actor, "complaint:manage");
  const complaint = await prisma.complaint.findUnique({
    where: { id: input.complaintId },
  });
  if (!complaint) throw new NotFoundError("Complaint not found.");

  await prisma.complaintResponse.create({
    data: {
      complaintId: complaint.id,
      adminId: actor.id,
      message: input.message,
      statusChange: input.status,
    },
  });
  await prisma.complaint.update({
    where: { id: complaint.id },
    data: { status: input.status },
  });
  await notifyUsers([complaint.studentId], {
    type: "COMPLAINT_UPDATE",
    title: "Complaint updated",
    body: `Your complaint "${complaint.subject}" is now ${input.status.replace("_", " ").toLowerCase()}.`,
    link: "/student/complaints",
  });

  await writeAudit({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "complaint.respond",
    entityType: "Complaint",
    entityId: complaint.id,
    summary: `Status -> ${input.status}`,
  });
}
