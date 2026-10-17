"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import * as svc from "@/lib/services/timetable-service";
import {
  formatZodError,
  timetableEditSchema,
  timetableGenerateSchema,
} from "@/lib/validation";
import { ActionState, runAction } from "./types";

function invalid(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { ok: false, message, fieldErrors, data: null };
}

export async function generateTimetableAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = timetableGenerateSchema.safeParse({
    termId: formData.get("termId"),
  });
  if (!parsed.success) {
    return invalid("Please choose an academic term.", formatZodError(parsed.error));
  }
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    const result = await svc.generateTimetable(actor, parsed.data.termId);
    revalidatePath("/admin/timetable");
    return {
      ok: true,
      message: result.satisfied
        ? `Generated ${result.placed} sessions with no conflicts.`
        : `Placed ${result.placed} sessions but ${result.conflicts.length} conflict(s) remain — see details below.`,
      data: { conflicts: result.conflicts, versionId: result.versionId },
    };
  });
  return state;
}

export async function submitForReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get("versionId") ?? "");
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    await svc.submitForReview(actor, versionId);
    revalidatePath("/admin/timetable");
    return { ok: true, message: "Sent for review.", data: null };
  });
  return state;
}

export async function approveTimetableAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get("versionId") ?? "");
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    await svc.approveTimetable(actor, versionId);
    revalidatePath("/admin/timetable");
    return { ok: true, message: "Timetable approved.", data: null };
  });
  return state;
}

export async function publishTimetableAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get("versionId") ?? "");
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    await svc.publishTimetable(actor, versionId);
    revalidatePath("/admin/timetable");
    revalidatePath("/student/timetable");
    revalidatePath("/faculty/timetable");
    return { ok: true, message: "Timetable published and affected users notified.", data: null };
  });
  return state;
}

export async function editSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = timetableEditSchema.safeParse({
    versionId: formData.get("versionId"),
    slotId: formData.get("slotId"),
    day: formData.get("day"),
    periodIndex: formData.get("periodIndex"),
    classroomId: formData.get("classroomId") || undefined,
  });
  if (!parsed.success) {
    return invalid("Please check the slot values.", formatZodError(parsed.error));
  }
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    await svc.editSlot(actor, parsed.data);
    revalidatePath("/admin/timetable");
    return { ok: true, message: "Slot updated and re-validated.", data: null };
  });
  return state;
}
