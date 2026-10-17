import { describe, it, expect } from "vitest";
import { TIMETABLE_TRANSITIONS, type TimetableStatus } from "@/lib/constants";

function canTransition(from: TimetableStatus, to: TimetableStatus): boolean {
  return TIMETABLE_TRANSITIONS[from].includes(to);
}

describe("timetable state machine (M05-R11, SEC-Z05)", () => {
  it("allows generated timetables to go to review but never straight to published", () => {
    expect(canTransition("GENERATED", "IN_REVIEW")).toBe(true);
    expect(canTransition("GENERATED", "PUBLISHED")).toBe(false);
  });

  it("only reaches PUBLISHED from APPROVED", () => {
    const statuses = Object.keys(TIMETABLE_TRANSITIONS) as TimetableStatus[];
    for (const from of statuses) {
      if (from === "APPROVED") {
        expect(canTransition(from, "PUBLISHED")).toBe(true);
      } else {
        expect(canTransition(from, "PUBLISHED")).toBe(false);
      }
    }
  });

  it("moves DRAFT -> GENERATED and IN_REVIEW -> APPROVED", () => {
    expect(canTransition("DRAFT", "GENERATED")).toBe(true);
    expect(canTransition("IN_REVIEW", "APPROVED")).toBe(true);
  });

  it("treats PUBLISHED and ARCHIVED as effectively final", () => {
    expect(TIMETABLE_TRANSITIONS.PUBLISHED).toEqual(["ARCHIVED"]);
    expect(TIMETABLE_TRANSITIONS.ARCHIVED).toEqual([]);
  });

  it("does not reach PUBLISHED in a single step from any pre-review state", () => {
    for (const from of ["DRAFT", "GENERATED", "IN_REVIEW"] as TimetableStatus[]) {
      expect(canTransition(from, "PUBLISHED")).toBe(false);
    }
  });
});
