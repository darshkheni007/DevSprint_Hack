/**
 * Domain constants shared by the whole application.
 *
 * SQLite does not support Prisma enums, so values are stored as strings and
 * validated here / in src/lib/validation.ts.
 */

export const ROLES = ["ADMIN", "FACULTY", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  FACULTY: "Faculty",
  STUDENT: "Student",
};

export const TIMETABLE_STATUSES = [
  "DRAFT",
  "GENERATED",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type TimetableStatus = (typeof TIMETABLE_STATUSES)[number];

/**
 * Allowed timetable state transitions. A timetable is NEVER auto-published:
 * the only path to PUBLISHED is GENERATED -> ... -> APPROVED -> PUBLISHED and
 * only an Admin may perform approve/publish.
 */
export const TIMETABLE_TRANSITIONS: Record<TimetableStatus, TimetableStatus[]> = {
  DRAFT: ["GENERATED", "ARCHIVED"],
  GENERATED: ["IN_REVIEW", "GENERATED", "ARCHIVED"],
  IN_REVIEW: ["APPROVED", "GENERATED", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "IN_REVIEW", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const NOTICE_AUDIENCES = [
  "ALL",
  "ADMIN",
  "FACULTY",
  "STUDENT",
  "COURSE",
  "BATCH",
] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number];

export const COMPLAINT_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const BORROW_STATUSES = ["BORROWED", "RETURNED", "OVERDUE"] as const;

/** Faculty lecture-swap request lifecycle. */
export const SWAP_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "FINALIZED",
  "FAILED",
  "CANCELLED",
] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "NOTICE",
  "ASSIGNMENT_DEADLINE",
  "EXAM_REMINDER",
  "LOW_ATTENDANCE",
  "TIMETABLE_PUBLISHED",
  "TIMETABLE_CHANGED",
  "LIBRARY_DUE",
  "COMPLAINT_UPDATE",
  "COMPLAINT_NEW",
  "ACCOUNT",
  "LECTURE_SWAP",
  "LECTURE_CANCELLED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Working week: Monday(1) .. Saturday(6). */
export const DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

export const DEFAULT_PERIODS = [
  { index: 1, label: "P1", startTime: "09:00", endTime: "09:50" },
  { index: 2, label: "P2", startTime: "09:50", endTime: "10:40" },
  { index: 3, label: "P3", startTime: "10:55", endTime: "11:45" },
  { index: 4, label: "P4", startTime: "11:45", endTime: "12:35" },
  { index: 5, label: "P5", startTime: "13:30", endTime: "14:20" },
  { index: 6, label: "P6", startTime: "14:20", endTime: "15:10" },
];

export const DEFAULT_ATTENDANCE_THRESHOLD = 75;

export const SETTING_KEYS = {
  attendanceThreshold: "attendance.threshold.percent",
} as const;
