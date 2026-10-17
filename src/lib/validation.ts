import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  COMPLAINT_STATUSES,
  NOTICE_AUDIENCES,
  ROLES,
} from "./constants";

/**
 * Shared Zod schemas (SEC-V01). These are used on the server for every write
 * path. Client-side reuse is a convenience only — the server is authoritative.
 */

const nonEmpty = (max = 200) =>
  z.string().trim().min(1, "This field is required.").max(max);

export const loginSchema = z.object({
  identifier: nonEmpty(120),
  password: z.string().min(1, "Password is required.").max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(10, "New password must be at least 10 characters."),
    confirmPassword: z.string().min(1, "Please confirm the new password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const userCreateSchema = z.object({
  firstName: nonEmpty(60),
  lastName: nonEmpty(60),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  loginId: nonEmpty(60),
  role: z.enum(ROLES),
  departmentId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
  designation: z.string().max(80).optional(),
  admissionYear: z.coerce.number().int().min(1990).max(2100).optional(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  firstName: nonEmpty(60).optional(),
  lastName: nonEmpty(60).optional(),
  phone: z.string().max(30).optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const departmentSchema = z.object({
  code: nonEmpty(12),
  name: nonEmpty(120),
});

export const courseSchema = z.object({
  code: nonEmpty(12),
  name: nonEmpty(120),
  departmentId: z.string().min(1),
  durationYears: z.coerce.number().int().min(1).max(6).default(4),
});

export const subjectSchema = z.object({
  code: nonEmpty(16),
  name: nonEmpty(120),
  courseId: z.string().min(1),
  departmentId: z.string().min(1),
  credits: z.coerce.number().int().min(0).max(12).default(3),
  semester: z.coerce.number().int().min(1).max(12).default(1),
  isLab: z.boolean().default(false),
});

export const batchSchema = z.object({
  name: nonEmpty(60),
  courseId: z.string().min(1),
  termId: z.string().min(1),
  semester: z.coerce.number().int().min(1).max(12),
  strength: z.coerce.number().int().min(1).max(500),
});

export const classroomSchema = z.object({
  code: nonEmpty(16),
  name: nonEmpty(80),
  capacity: z.coerce.number().int().min(1).max(1000),
  type: z.enum(["LECTURE", "LAB"]).default("LECTURE"),
  building: z.string().max(80).optional(),
});

export const offeringSchema = z.object({
  subjectId: z.string().min(1),
  batchId: z.string().min(1),
  facultyId: z.string().min(1),
  weeklySessions: z.coerce.number().int().min(1).max(6).default(3),
});

export const timetableGenerateSchema = z.object({
  termId: z.string().min(1),
});

export const timetableEditSchema = z.object({
  versionId: z.string().min(1),
  slotId: z.string().min(1),
  day: z.coerce.number().int().min(1).max(6),
  periodIndex: z.coerce.number().int().min(1).max(8),
  classroomId: z.string().min(1).optional(),
});

export const swapRequestSchema = z.object({
  requesterSlotId: z.string().min(1),
  recipientSlotId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});
export type SwapRequestInput = z.infer<typeof swapRequestSchema>;

export const swapDecisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["ACCEPT", "REJECT"]),
});
export type SwapDecisionInput = z.infer<typeof swapDecisionSchema>;

export const lectureCancellationSchema = z.object({
  slotId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date (YYYY-MM-DD)."),
  reason: z.string().trim().max(500).optional(),
});
export type LectureCancellationInput = z.infer<typeof lectureCancellationSchema>;

export const attendanceSchema = z.object({
  classSessionId: z.string().min(1),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
      }),
    )
    .min(1, "At least one entry is required."),
});
export type AttendanceInput = z.infer<typeof attendanceSchema>;

export const classSessionSchema = z.object({
  offeringId: z.string().min(1),
  date: z.string().min(1),
  day: z.coerce.number().int().min(1).max(6),
  periodIndex: z.coerce.number().int().min(1).max(8),
  topic: z.string().max(200).optional(),
});

export const marksSchema = z.object({
  examId: z.string().min(1),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        marks: z.coerce.number().min(0, "Marks cannot be negative."),
      }),
    )
    .min(1),
});
export type MarksInput = z.infer<typeof marksSchema>;

export const examSchema = z.object({
  subjectId: z.string().min(1),
  batchId: z.string().min(1),
  termId: z.string().min(1),
  name: nonEmpty(120),
  examDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  classroomId: z.string().min(1).optional(),
  maxMarks: z.coerce.number().int().min(1).max(1000),
});

export const noticeSchema = z.object({
  title: nonEmpty(160),
  body: nonEmpty(4000),
  audience: z.enum(NOTICE_AUDIENCES),
  courseId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
});
export type NoticeInput = z.infer<typeof noticeSchema>;

export const assignmentSchema = z.object({
  offeringId: z.string().min(1),
  title: nonEmpty(160),
  description: nonEmpty(4000),
  deadline: z.string().min(1),
  maxMarks: z.coerce.number().int().min(1).max(500).default(100),
});
export type AssignmentInput = z.infer<typeof assignmentSchema>;

export const feedbackSchema = z.object({
  facultyId: z.string().min(1).optional(),
  subject: nonEmpty(160),
  message: nonEmpty(4000),
  isAnonymous: z.boolean().default(true),
});

export const complaintSchema = z.object({
  category: nonEmpty(60),
  subject: nonEmpty(160),
  message: nonEmpty(4000),
});
export type ComplaintInput = z.infer<typeof complaintSchema>;

export const complaintResponseSchema = z.object({
  complaintId: z.string().min(1),
  message: nonEmpty(4000),
  status: z.enum(COMPLAINT_STATUSES),
});

export const bookSchema = z.object({
  title: nonEmpty(200),
  author: nonEmpty(120),
  isbn: nonEmpty(20),
  category: nonEmpty(60),
  totalCopies: z.coerce.number().int().min(1).max(1000),
});

export const borrowSchema = z.object({
  bookId: z.string().min(1),
  userId: z.string().min(1).optional(),
  dueDate: z.string().min(1),
});

/** Maximum assistant question length (kept in sync with the UI message). */
export const ASSISTANT_QUESTION_MAX = 500;

export const assistantSchema = z.object({
  question: nonEmpty(ASSISTANT_QUESTION_MAX),
});

export const settingsSchema = z.object({
  attendanceThreshold: z.coerce.number().min(1).max(100),
});

/** Helper: format Zod issues into a fieldErrors map for API responses. */
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] = out[key] ? [...out[key], issue.message] : [issue.message];
  }
  return out;
}
