import { describe, it, expect } from "vitest";
import {
  can,
  authorize,
  requireActor,
  assertOwnership,
  type Actor,
} from "@/lib/permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const admin: Actor = {
  id: "u-admin",
  role: "ADMIN",
  name: "Ada Admin",
  email: "admin@campus.edu",
};

const faculty: Actor = {
  id: "u-fac",
  role: "FACULTY",
  name: "Fiona Faculty",
  email: "fac@campus.edu",
  facultyProfileId: "fp-1",
};

const student: Actor = {
  id: "u-stu",
  role: "STUDENT",
  name: "Sam Student",
  email: "stu@campus.edu",
  studentProfileId: "sp-1",
  batchId: "batch-A",
};

describe("role capability matrix", () => {
  it("allows admin-only capabilities for ADMIN and denies them elsewhere", () => {
    for (const action of [
      "user:create",
      "user:list",
      "academic:manage",
      "timetable:publish",
      "results:publish",
      "audit:read",
      "settings:manage",
      "complaint:manage",
      "notice:create:global",
    ] as const) {
      expect(can(admin, action)).toBe(true);
      expect(can(faculty, action)).toBe(false);
      expect(can(student, action)).toBe(false);
    }
  });

  it("denies every action to an unauthenticated actor", () => {
    expect(can(null, "timetable:read")).toBe(false);
    expect(can(undefined, "profile:read")).toBe(false);
  });
});

describe("assignment-scoped faculty writes (SEC-Z03)", () => {
  it("permits attendance:record only for the assigned faculty", () => {
    expect(
      can(faculty, "attendance:record", { assignedFacultyId: faculty.id }),
    ).toBe(true);
    expect(
      can(faculty, "attendance:record", { assignedFacultyId: "someone-else" }),
    ).toBe(false);
    expect(can(faculty, "attendance:record", {})).toBe(false);
  });

  it("permits marks:enter only for the assigned faculty", () => {
    expect(can(faculty, "marks:enter", { assignedFacultyId: faculty.id })).toBe(
      true,
    );
    expect(can(faculty, "marks:enter", { assignedFacultyId: "x" })).toBe(false);
  });
});

describe("published-only scoped reads (SEC-Z06)", () => {
  it("lets faculty read their own published timetable only", () => {
    expect(
      can(faculty, "timetable:read", {
        isPublished: true,
        assignedFacultyId: faculty.id,
      }),
    ).toBe(true);
    // unpublished drafts are not visible to faculty
    expect(
      can(faculty, "timetable:read", {
        isPublished: false,
        assignedFacultyId: faculty.id,
      }),
    ).toBe(false);
  });

  it("lets a student read only their own batch's published timetable", () => {
    expect(
      can(student, "timetable:read", {
        isPublished: true,
        assignedBatchId: "batch-A",
      }),
    ).toBe(true);
    expect(
      can(student, "timetable:read", {
        isPublished: true,
        assignedBatchId: "batch-B",
      }),
    ).toBe(false);
    expect(
      can(student, "timetable:read", {
        isPublished: false,
        assignedBatchId: "batch-A",
      }),
    ).toBe(false);
  });
});

describe("student write restrictions (SEC-Z07)", () => {
  it("denies students all recording/management actions", () => {
    for (const action of [
      "attendance:record",
      "marks:enter",
      "results:publish",
      "assignment:create",
      "exam:manage",
      "user:create",
      "user:deactivate",
      "library:manage",
      "feedback:read:all",
      "complaint:manage",
      "timetable:generate",
      "timetable:approve",
      "timetable:publish",
      "settings:manage",
      "audit:read",
    ] as const) {
      expect(can(student, action)).toBe(false);
    }
  });
});

describe("authorize / requireActor / assertOwnership", () => {
  it("throws UnauthorizedError when there is no actor", () => {
    expect(() => authorize(null, "timetable:read")).toThrow(UnauthorizedError);
    expect(() => requireActor(null)).toThrow(UnauthorizedError);
  });

  it("throws ForbiddenError when the actor lacks the capability", () => {
    expect(() => authorize(student, "user:create")).toThrow(ForbiddenError);
  });

  it("returns the actor when permitted", () => {
    expect(authorize(admin, "settings:manage")).toBe(admin);
  });

  it("enforces student record ownership", () => {
    expect(() => assertOwnership(student, student.id)).not.toThrow();
    expect(() => assertOwnership(student, "other-user")).toThrow(ForbiddenError);
    // non-students are not bound by own-record restriction here
    expect(() => assertOwnership(admin, "someone-else")).not.toThrow();
  });
});
