"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import { createExam, enterMarks, publishResults } from "@/lib/services/marks-service";
import { examSchema, formatZodError, marksSchema } from "@/lib/validation";
import { ActionState, runAction } from "./types";

export async function enterMarksAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const entries: { studentId: string; marks: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("marks_")) {
      const studentId = key.slice("marks_".length);
      const raw = String(value).trim();
      if (studentId && raw !== "") {
        entries.push({ studentId, marks: Number(raw) });
      }
    }
  }
  const parsed = marksSchema.safeParse({
    examId: formData.get("examId"),
    entries,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the marks you entered.",
      fieldErrors: formatZodError(parsed.error),
      data: null,
    };
  }
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    const result = await enterMarks(actor, parsed.data);
    revalidatePath("/faculty/marks");
    return { ok: true, message: `Saved marks for ${result.saved} student(s).`, data: null };
  });
  return state;
}

export async function createExamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = examSchema.safeParse({
    subjectId: formData.get("subjectId"),
    batchId: formData.get("batchId"),
    termId: formData.get("termId"),
    name: formData.get("name"),
    examDate: formData.get("examDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    classroomId: formData.get("classroomId") || undefined,
    maxMarks: formData.get("maxMarks") || 100,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the exam details.",
      fieldErrors: formatZodError(parsed.error),
      data: null,
    };
  }
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createExam(actor, parsed.data);
    revalidatePath("/admin/exams");
    return { ok: true, message: "Exam scheduled.", data: null };
  });
}

export async function publishResultsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const examId = String(formData.get("examId") ?? "");
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    await publishResults(actor, examId);
    revalidatePath("/admin/exams");
    revalidatePath("/student/results");
    return { ok: true, message: "Results published and students notified.", data: null };
  });
  return state;
}
