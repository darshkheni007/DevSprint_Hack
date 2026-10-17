"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import { createNotice } from "@/lib/services/notice-service";
import { createAssignment } from "@/lib/services/assignment-service";
import {
  respondToComplaint,
  submitComplaint,
  submitFeedback,
} from "@/lib/services/feedback-service";
import {
  assignmentSchema,
  complaintResponseSchema,
  complaintSchema,
  feedbackSchema,
  formatZodError,
  noticeSchema,
} from "@/lib/validation";
import { ActionState, runAction } from "./types";

function invalid(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { ok: false, message, fieldErrors, data: null };
}

export async function createNoticeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = noticeSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audience: formData.get("audience"),
    courseId: formData.get("courseId") || undefined,
    batchId: formData.get("batchId") || undefined,
  });
  if (!parsed.success) return invalid("Please check the notice.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createNotice(actor, parsed.data);
    revalidatePath("/admin/notices");
    revalidatePath("/faculty/notices");
    revalidatePath("/student/notices");
    return { ok: true, message: "Notice published and recipients notified.", data: null };
  });
}

export async function createAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = assignmentSchema.safeParse({
    offeringId: formData.get("offeringId"),
    title: formData.get("title"),
    description: formData.get("description"),
    deadline: formData.get("deadline"),
    maxMarks: formData.get("maxMarks") || 100,
  });
  if (!parsed.success) return invalid("Please check the assignment.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createAssignment(actor, parsed.data);
    revalidatePath("/faculty/assignments");
    return { ok: true, message: "Assignment created and students notified.", data: null };
  });
}

export async function submitComplaintAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = complaintSchema.safeParse({
    category: formData.get("category"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    const complaint = await submitComplaint(actor, parsed.data);
    revalidatePath("/student/complaints");
    return {
      ok: true,
      message: `Complaint submitted. Your reference is ${complaint.id.slice(-6).toUpperCase()}.`,
      data: null,
    };
  });
}

export async function submitFeedbackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = feedbackSchema.safeParse({
    facultyId: formData.get("facultyId") || undefined,
    subject: formData.get("subject"),
    message: formData.get("message"),
    isAnonymous: formData.get("isAnonymous") === "on" || formData.get("isAnonymous") === "true",
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await submitFeedback(actor, parsed.data);
    revalidatePath("/student/complaints");
    return { ok: true, message: "Thank you — your feedback has been submitted.", data: null };
  });
}

export async function respondComplaintAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = complaintResponseSchema.safeParse({
    complaintId: formData.get("complaintId"),
    message: formData.get("message"),
    status: formData.get("status"),
  });
  if (!parsed.success) return invalid("Please check the response.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await respondToComplaint(actor, parsed.data);
    revalidatePath("/admin/complaints");
    return { ok: true, message: "Response sent and status updated.", data: null };
  });
}
