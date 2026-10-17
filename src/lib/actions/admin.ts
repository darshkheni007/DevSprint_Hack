"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import {
  createUser,
  setUserActive,
} from "@/lib/services/identity-service";
import {
  createBatch,
  createClassroom,
  createCourse,
  createDepartment,
  createOffering,
  createSubject,
} from "@/lib/services/academic-service";
import { borrowBook, returnBook } from "@/lib/services/library-service";
import { setAttendanceThreshold } from "@/lib/settings";
import {
  batchSchema,
  borrowSchema,
  classroomSchema,
  courseSchema,
  departmentSchema,
  formatZodError,
  offeringSchema,
  settingsSchema,
  subjectSchema,
  userCreateSchema,
} from "@/lib/validation";
import { ActionState, runAction } from "./types";

function invalid(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { ok: false, message, fieldErrors, data: null };
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = userCreateSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    loginId: formData.get("loginId"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || undefined,
    batchId: formData.get("batchId") || undefined,
    designation: formData.get("designation") || undefined,
    admissionYear: formData.get("admissionYear") || undefined,
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    const created = await createUser(actor, parsed.data);
    revalidatePath("/admin/users");
    return {
      ok: true,
      message: "Account created.",
      data: { userId: created.id, temporaryPassword: created.temporaryPassword },
    };
  });
  return state;
}

export async function setUserActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("userId") ?? "");
  const isActive = String(formData.get("isActive")) === "true";
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await setUserActive(actor, userId, isActive);
    revalidatePath("/admin/users");
    return {
      ok: true,
      message: isActive ? "Account activated." : "Account deactivated.",
      data: null,
    };
  });
}

export async function createDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = departmentSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createDepartment(actor, parsed.data);
    revalidatePath("/admin/academic");
    return { ok: true, message: "Department created.", data: null };
  });
}

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = courseSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    departmentId: formData.get("departmentId"),
    durationYears: formData.get("durationYears") || 4,
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createCourse(actor, parsed.data);
    revalidatePath("/admin/academic");
    return { ok: true, message: "Course created.", data: null };
  });
}

export async function createSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = subjectSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    courseId: formData.get("courseId"),
    departmentId: formData.get("departmentId"),
    credits: formData.get("credits") || 3,
    semester: formData.get("semester") || 1,
    isLab: formData.get("isLab") === "on" || formData.get("isLab") === "true",
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createSubject(actor, parsed.data);
    revalidatePath("/admin/academic");
    return { ok: true, message: "Subject created.", data: null };
  });
}

export async function createBatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = batchSchema.safeParse({
    name: formData.get("name"),
    courseId: formData.get("courseId"),
    termId: formData.get("termId"),
    semester: formData.get("semester"),
    strength: formData.get("strength"),
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createBatch(actor, parsed.data);
    revalidatePath("/admin/academic");
    return { ok: true, message: "Batch created.", data: null };
  });
}

export async function createClassroomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = classroomSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    capacity: formData.get("capacity"),
    type: formData.get("type") || "LECTURE",
    building: formData.get("building") || undefined,
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createClassroom(actor, parsed.data);
    revalidatePath("/admin/academic");
    return { ok: true, message: "Classroom created.", data: null };
  });
}

export async function createOfferingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = offeringSchema.safeParse({
    subjectId: formData.get("subjectId"),
    batchId: formData.get("batchId"),
    facultyId: formData.get("facultyId"),
    weeklySessions: formData.get("weeklySessions") || 3,
  });
  if (!parsed.success) return invalid("Please check the form.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await createOffering(actor, parsed.data);
    revalidatePath("/admin/academic");
    return { ok: true, message: "Subject offering created.", data: null };
  });
}

export async function setThresholdAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = settingsSchema.safeParse({
    attendanceThreshold: formData.get("attendanceThreshold"),
  });
  if (!parsed.success) return invalid("Enter a percentage between 1 and 100.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await setAttendanceThreshold(parsed.data.attendanceThreshold);
    return { ok: true, message: "Attendance threshold updated.", data: null };
  });
}

export async function borrowBookAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = borrowSchema.safeParse({
    bookId: formData.get("bookId"),
    userId: formData.get("userId") || undefined,
    dueDate: formData.get("dueDate") || new Date(Date.now() + 14 * 864e5).toISOString(),
  });
  if (!parsed.success) return invalid("Please check the request.", formatZodError(parsed.error));
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await borrowBook(actor, parsed.data);
    revalidatePath("/student/library");
    revalidatePath("/admin/academic");
    return { ok: true, message: "Book issued. Please return it by the due date.", data: null };
  });
}

export async function returnBookAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const borrowRecordId = String(formData.get("borrowRecordId") ?? "");
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await returnBook(actor, borrowRecordId);
    revalidatePath("/admin/academic");
    revalidatePath("/admin/library");
    return { ok: true, message: "Return recorded.", data: null };
  });
}
