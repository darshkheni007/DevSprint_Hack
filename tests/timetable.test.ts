import { describe, it, expect } from "vitest";
import {
  solve,
  type SolverInput,
  type SolverRoom,
  type SolverTask,
} from "@/lib/timetable/solver";
import { validateSchedule } from "@/lib/timetable/validator";

const DAYS = [1, 2, 3, 4, 5, 6];
const PERIODS = [1, 2, 3, 4, 5, 6];

const LECTURE_ROOM: SolverRoom = { id: "r-lect", code: "L1", capacity: 60, type: "LECTURE" };
const LAB_ROOM: SolverRoom = { id: "r-lab", code: "LAB1", capacity: 40, type: "LAB" };

function baseInput(tasks: SolverTask[], rooms: SolverRoom[] = [LECTURE_ROOM, LAB_ROOM]): SolverInput {
  return {
    tasks,
    rooms,
    days: DAYS,
    periods: PERIODS,
    availability: new Map(),
  };
}

const LECTURE_TASK: SolverTask = {
  offeringId: "off-lect",
  subjectLabel: "CS101 Data Structures",
  batchId: "batch-A",
  batchStrength: 50,
  facultyId: "u-fac",
  facultyName: "Fiona Faculty",
  isLab: false,
  sessions: 3,
};

const LAB_TASK: SolverTask = {
  offeringId: "off-lab",
  subjectLabel: "CS102 Data Structures Lab",
  batchId: "batch-A",
  batchStrength: 30,
  facultyId: "u-fac",
  facultyName: "Fiona Faculty",
  isLab: true,
  sessions: 2,
};

describe("timetable solver — hard constraints", () => {
  it("places every session and produces a schedule the validator accepts", () => {
    const input = baseInput([LECTURE_TASK, LAB_TASK]);
    const result = solve(input);

    expect(result.satisfied).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.assignments).toHaveLength(5);

    const validation = validateSchedule(input, result.assignments);
    expect(validation.valid).toBe(true);
    expect(validation.violations).toHaveLength(0);
  });

  it("never double-books a faculty member, room or batch", () => {
    const input = baseInput([LECTURE_TASK, LAB_TASK]);
    const result = solve(input);

    const facultySlots = result.assignments.map(
      (a) => `${a.facultyId}|${a.day}:${a.periodIndex}`,
    );
    const roomSlots = result.assignments.map(
      (a) => `${a.classroomId}|${a.day}:${a.periodIndex}`,
    );
    const batchSlots = result.assignments.map(
      (a) => `${a.batchId}|${a.day}:${a.periodIndex}`,
    );

    expect(new Set(facultySlots).size).toBe(facultySlots.length);
    expect(new Set(roomSlots).size).toBe(roomSlots.length);
    expect(new Set(batchSlots).size).toBe(batchSlots.length);
  });

  it("places lab sessions only in lab rooms", () => {
    const input = baseInput([LECTURE_TASK, LAB_TASK]);
    const result = solve(input);
    const labSessions = result.assignments.filter((a) => a.offeringId === "off-lab");
    expect(labSessions).toHaveLength(2);
    for (const s of labSessions) {
      expect(s.classroomId).toBe(LAB_ROOM.id);
      expect(s.slotType).toBe("LAB");
    }
  });

  it("is deterministic for identical input", () => {
    const a = solve(baseInput([LECTURE_TASK, LAB_TASK]));
    const b = solve(baseInput([LECTURE_TASK, LAB_TASK]));
    expect(JSON.stringify(a.assignments)).toBe(JSON.stringify(b.assignments));
  });

  it("returns a best-effort partial plus conflicts when no room is large enough", () => {
    const bigTask: SolverTask = { ...LECTURE_TASK, batchStrength: 120, sessions: 2 };
    const input = baseInput([bigTask], [LECTURE_ROOM]); // capacity 60 < 120
    const result = solve(input);

    expect(result.satisfied).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0]?.suggestion).toContain("lecture room");

    // Whatever it did place must still be valid.
    expect(validateSchedule(input, result.assignments).valid).toBe(true);
    expect(result.assignments).toHaveLength(0);
  });

  it("respects faculty availability windows", () => {
    const restricted: SolverTask = { ...LECTURE_TASK, sessions: 1 };
    const availability = new Map<string, Set<string>>([
      [restricted.facultyId, new Set(["1:1", "1:2"])],
    ]);
    const input: SolverInput = {
      tasks: [restricted],
      rooms: [LECTURE_ROOM],
      days: DAYS,
      periods: PERIODS,
      availability,
    };
    const result = solve(input);
    expect(result.satisfied).toBe(true);
    expect(result.assignments).toHaveLength(1);
    const placed = result.assignments[0]!;
    expect(availability.get(restricted.facultyId)!.has(`${placed.day}:${placed.periodIndex}`)).toBe(true);
  });
});

describe("timetable validator — independent detection", () => {
  it("detects a faculty double-booking", () => {
    const input = baseInput([LECTURE_TASK]);
    const assignments = [
      { offeringId: "off-lect", batchId: "batch-A", facultyId: "u-fac", classroomId: "r-lect", day: 1, periodIndex: 1, slotType: "LECTURE" as const },
      { offeringId: "off-lect", batchId: "batch-B", facultyId: "u-fac", classroomId: "r-lab", day: 1, periodIndex: 1, slotType: "LECTURE" as const },
    ];
    const result = validateSchedule(input, assignments);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === "FACULTY_CLASH")).toBe(true);
  });

  it("detects a room capacity violation", () => {
    const small: SolverRoom = { id: "r-small", code: "S1", capacity: 10, type: "LECTURE" };
    const input = baseInput([LECTURE_TASK], [small]);
    const assignments = [
      { offeringId: "off-lect", batchId: "batch-A", facultyId: "u-fac", classroomId: "r-small", day: 1, periodIndex: 1, slotType: "LECTURE" as const },
    ];
    const result = validateSchedule(input, assignments);
    expect(result.violations.some((v) => v.kind === "CAPACITY")).toBe(true);
  });

  it("detects a room type violation", () => {
    const input = baseInput([LAB_TASK]);
    const assignments = [
      { offeringId: "off-lab", batchId: "batch-A", facultyId: "u-fac", classroomId: "r-lect", day: 2, periodIndex: 2, slotType: "LAB" as const },
    ];
    const result = validateSchedule(input, assignments);
    expect(result.violations.some((v) => v.kind === "ROOM_TYPE")).toBe(true);
  });

  it("detects an availability violation", () => {
    const availability = new Map<string, Set<string>>([["u-fac", new Set(["1:1"])]]);
    const input: SolverInput = {
      tasks: [LECTURE_TASK],
      rooms: [LECTURE_ROOM],
      days: DAYS,
      periods: PERIODS,
      availability,
    };
    const assignments = [
      { offeringId: "off-lect", batchId: "batch-A", facultyId: "u-fac", classroomId: "r-lect", day: 3, periodIndex: 3, slotType: "LECTURE" as const },
    ];
    const result = validateSchedule(input, assignments);
    expect(result.violations.some((v) => v.kind === "AVAILABILITY")).toBe(true);
  });

  it("detects too many sessions for an offering", () => {
    const input = baseInput([LECTURE_TASK]); // requires 3
    const assignments = Array.from({ length: 4 }, (_, i) => ({
      offeringId: "off-lect",
      batchId: "batch-A",
      facultyId: "u-fac",
      classroomId: "r-lect",
      day: i + 1,
      periodIndex: 1,
      slotType: "LECTURE" as const,
    }));
    const result = validateSchedule(input, assignments);
    expect(result.violations.some((v) => v.kind === "TOO_MANY_SESSIONS")).toBe(true);
  });
});
