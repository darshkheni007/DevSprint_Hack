"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import * as svc from "@/lib/services/cancellation-service";
import { formatZodError, lectureCancellationSchema } from "@/lib/validation";
import { ActionState, runAction } from "./types";

function invalid(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { ok: false, message, fieldErrors, data: null };
}

export async function cancelLectureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = lectureCancellationSchema.safeParse({
    slotId: formData.get("slotId"),
    date: formData.get("date"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return invalid("Please choose a lecture and a valid date.", formatZodError(parsed.error));
  }
  return runAction(async () => {
    const actor = await requireCurrentActor();
    const result = await svc.cancelLecture(actor, parsed.data);
    revalidatePath("/faculty/timetable");
    revalidatePath("/faculty/attendance");
    revalidatePath("/student/timetable");
    revalidatePath("/student/attendance");
    revalidatePath("/admin/timetable");
    revalidatePath("/notifications");
    revalidatePath("/faculty");
    revalidatePath("/student");
    return {
      ok: true,
      message: result.duplicate
        ? "This lecture was already cancelled for that date."
        : "Lecture cancelled. Affected students and faculty have been notified.",
      data: { date: result.date, duplicate: result.duplicate },
    };
  });
}
