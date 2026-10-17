/**
 * Central authorization policy (SEC-Z01).
 *
 * Every service action calls `authorize(actor, action, ctx)`. No ad-hoc role
 * checks are performed in UI or route handlers. `can()` encodes both the
 * role-permission matrix (requirements/02 §2) and the ownership / assignment
 * scope rules (SEC-Z02, SEC-Z03, SEC-Z04).
 */
import { Role } from "./constants";
import { ForbiddenError, UnauthorizedError } from "./errors";

export interface Actor {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** StudentProfile.id when the actor is a student. */
  studentProfileId?: string | null;
  /** FacultyProfile.id when the actor is faculty. */
  facultyProfileId?: string | null;
  /** Batch the student is enrolled in. */
  batchId?: string | null;
}

export type Action =
  | "profile:read"
  | "profile:update"
  | "user:list"
  | "user:create"
  | "user:update"
  | "user:deactivate"
  | "academic:read"
  | "academic:manage"
  | "timetable:read"
  | "timetable:generate"
  | "timetable:edit"
  | "timetable:approve"
  | "timetable:publish"
  | "swap:read"
  | "swap:request"
  | "swap:respond"
  | "lecture:cancel"
  | "attendance:record"
  | "attendance:read:any"
  | "attendance:report"
  | "marks:enter"
  | "marks:read:any"
  | "results:publish"
  | "assignment:create"
  | "assignment:read"
  | "exam:manage"
  | "exam:read"
  | "notice:create:global"
  | "notice:create:course"
  | "notice:read"
  | "analytics:read:all"
  | "analytics:read:class"
  | "analytics:read:own"
  | "library:manage"
  | "library:read"
  | "library:borrow"
  | "feedback:submit"
  | "feedback:read:all"
  | "feedback:read:own"
  | "complaint:submit"
  | "complaint:read:own"
  | "complaint:manage"
  | "assistant:use"
  | "audit:read"
  | "settings:manage";

export interface ResourceContext {
  /** User.id of the record owner. */
  ownerUserId?: string | null;
  /** StudentProfile.id of the record owner. */
  ownerStudentProfileId?: string | null;
  /** SubjectOffering.facultyId — the faculty the record is assigned to. */
  assignedFacultyId?: string | null;
  /** Batch the record belongs to. */
  assignedBatchId?: string | null;
  /** Whether the record has been published (timetable/results). */
  isPublished?: boolean;
}

/** Base capability matrix — role → allowed actions (before scope checks). */
const BASE: Record<Role, ReadonlySet<Action>> = {
  ADMIN: new Set<Action>([
    "profile:read",
    "profile:update",
    "user:list",
    "user:create",
    "user:update",
    "user:deactivate",
    "academic:read",
    "academic:manage",
    "timetable:read",
    "timetable:generate",
    "timetable:edit",
    "timetable:approve",
    "timetable:publish",
    "swap:read",
    "lecture:cancel",
    "attendance:read:any",
    "attendance:report",
    "marks:read:any",
    "results:publish",
    "assignment:read",
    "exam:manage",
    "exam:read",
    "notice:create:global",
    "notice:read",
    "analytics:read:all",
    "library:manage",
    "library:read",
    "feedback:read:all",
    "complaint:manage",
    "assistant:use",
    "audit:read",
    "settings:manage",
  ]),
  FACULTY: new Set<Action>([
    "profile:read",
    "profile:update",
    "academic:read",
    "timetable:read",
    "swap:read",
    "swap:request",
    "swap:respond",
    "lecture:cancel",
    "attendance:record",
    "marks:enter",
    "assignment:create",
    "assignment:read",
    "exam:read",
    "notice:create:course",
    "notice:read",
    "analytics:read:class",
    "library:read",
    "assistant:use",
  ]),
  STUDENT: new Set<Action>([
    "profile:read",
    "profile:update",
    "academic:read",
    "timetable:read",
    "assignment:read",
    "exam:read",
    "notice:read",
    "analytics:read:own",
    "library:read",
    "library:borrow",
    "feedback:submit",
    "complaint:submit",
    "complaint:read:own",
    "assistant:use",
  ]),
};

export function can(
  actor: Actor | null | undefined,
  action: Action,
  ctx: ResourceContext = {},
): boolean {
  if (!actor) return false;
  if (!BASE[actor.role].has(action)) return false;

  switch (action) {
    // --- Ownership-scoped reads -----------------------------------------
    case "profile:read":
    case "profile:update":
      // Admin manages accounts via user:*; profile access is always own.
      return true;

    // --- Assignment-scoped faculty writes (SEC-Z03) ---------------------
    case "attendance:record":
    case "marks:enter":
    case "assignment:create":
    case "notice:create:course":
      return (
        actor.role === "FACULTY" &&
        !!ctx.assignedFacultyId &&
        ctx.assignedFacultyId === actor.id
      );
    // --- Lecture swap consent + cancellation ownership ------------------
    case "swap:read":
      return true;
    case "swap:request":
      return actor.role === "FACULTY";
    case "swap:respond":
      // Only the nominated recipient may accept/reject their incoming request.
      return (
        actor.role === "FACULTY" &&
        !!ctx.ownerUserId &&
        ctx.ownerUserId === actor.id
      );
    case "lecture:cancel":
      if (actor.role === "ADMIN") return true;
      // Faculty may only cancel a lecture they are responsible for.
      return (
        actor.role === "FACULTY" &&
        !!ctx.assignedFacultyId &&
        ctx.assignedFacultyId === actor.id
      );

    // --- Published-only reads for students/faculty (SEC-Z06) ------------
    case "timetable:read": {
      if (actor.role === "ADMIN") return true;
      if (!ctx.isPublished) return false;
      if (actor.role === "FACULTY") {
        return !ctx.assignedFacultyId || ctx.assignedFacultyId === actor.id;
      }
      // Student: only own batch.
      return !!ctx.assignedBatchId && ctx.assignedBatchId === actor.batchId;
    }

    case "assignment:read": {
      if (actor.role === "ADMIN") return true;
      if (actor.role === "FACULTY") {
        return !ctx.assignedFacultyId || ctx.assignedFacultyId === actor.id;
      }
      return !!ctx.assignedBatchId && ctx.assignedBatchId === actor.batchId;
    }

    case "exam:read": {
      if (actor.role === "ADMIN") return true;
      if (actor.role === "FACULTY") {
        return !ctx.assignedFacultyId || ctx.assignedFacultyId === actor.id;
      }
      return !!ctx.assignedBatchId && ctx.assignedBatchId === actor.batchId;
    }

    default:
      return true;
  }
}

/** Throw when the actor is not authenticated. */
export function requireActor(actor: Actor | null | undefined): Actor {
  if (!actor) throw new UnauthorizedError();
  return actor;
}

/** Assert permission or throw 403 (deny by default). */
export function authorize(
  actor: Actor | null | undefined,
  action: Action,
  ctx: ResourceContext = {},
): Actor {
  const a = requireActor(actor);
  if (!can(a, action, ctx)) {
    throw new ForbiddenError();
  }
  return a;
}

/** Guard for student-owned records (SEC-Z02). */
export function assertOwnership(
  actor: Actor,
  ownerUserId: string | null | undefined,
): void {
  if (actor.role === "STUDENT" && ownerUserId !== actor.id) {
    throw new ForbiddenError();
  }
}
