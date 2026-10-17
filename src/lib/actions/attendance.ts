"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import * as svc from "@/lib/services/attendance-service";
import {
  attendanceSchema,
  classSessionSchema,
  formatZodError,
} from "@/lib/validation";
import { ATTENDANCE_STATUSES } from "@/lib/constants";
import { ActionState, runAction } from "./types";

export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = classSessionSchema.safeParse({
    offeringId: formData.get("offeringId"),
    date: formData.get("date"),
    day: formData.get("day"),
    periodIndex: formData.get("periodIndex"),
    topic: formData.get("topic") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the session details.",
      fieldErrors: formatZodError(parsed.error),
      data: null,
    };
  }
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    const session = await svc.createClassSession(actor, parsed.data);
    revalidatePath("/faculty/attendance");
    return {
      ok: true,
      message: "Class session created. You can now record attendance.",
      data: { sessionId: session.id },
    };
  });
  return state;
}

/** Parse `status_<studentId>` fields submitted by the attendance form. */
function parseEntries(formData: FormData) {
  const entries: { studentId: string; status: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("status_")) {
      const studentId = key.slice("status_".length);
      const status = String(value);
      if (
        studentId &&
        (ATTENDANCE_STATUSES as readonly string[]).includes(status)
      ) {
        entries.push({ studentId, status });
      }
    }
  }
  return entries;
}

export async function recordAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const entries = parseEntries(formData);
  const parsed = attendanceSchema.safeParse({
    classSessionId: formData.get("classSessionId"),
    entries,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please mark attendance for at least one student.",
      fieldErrors: formatZodError(parsed.error),
      data: null,
    };
  }
  const sessionId = parsed.data.classSessionId;
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    const result = await svc.recordAttendance(actor, parsed.data);
    revalidatePath(`/faculty/attendance`);
    revalidatePath(`/faculty/attendance/${sessionId}`);
    return {
      ok: true,
      message: `Attendance saved for ${result.saved} student(s).`,
      data: null,
    };
  });
  return state;
}
