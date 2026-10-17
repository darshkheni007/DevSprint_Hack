/**
 * Independent timetable validator (M05-R02..R05, AC-M05-02..05).
 *
 * This module deliberately does NOT share code with the solver's placement
 * loop. It re-derives the hard constraints from the raw inputs and the proposed
 * assignment list, so a solver bug cannot silently produce an "valid" schedule.
 * It is used before persisting a generated version and on every manual edit.
 */
import type { SolverAssignment, SolverInput, SolverRoom } from "./solver";

export interface Violation {
  kind:
    | "FACULTY_CLASH"
    | "ROOM_CLASH"
    | "BATCH_CLASH"
    | "CAPACITY"
    | "ROOM_TYPE"
    | "AVAILABILITY"
    | "UNKNOWN_ROOM"
    | "UNKNOWN_OFFERING"
    | "TOO_MANY_SESSIONS";
  message: string;
  offeringId?: string;
  day?: number;
  periodIndex?: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

function key(day: number, period: number): string {
  return `${day}:${period}`;
}

export function validateSchedule(
  input: SolverInput,
  assignments: SolverAssignment[],
): ValidationResult {
  const violations: Violation[] = [];

  const taskByOffering = new Map(input.tasks.map((t) => [t.offeringId, t]));
  const roomById = new Map<string, SolverRoom>(input.rooms.map((r) => [r.id, r]));
  const facultyAllowed = (facultyId: string, day: number, period: number) => {
    const allowed = input.availability.get(facultyId);
    return !allowed || allowed.has(key(day, period));
  };

  // Collision trackers.
  const facultySeen = new Map<string, number>();
  const roomSeen = new Map<string, number>();
  const batchSeen = new Map<string, number>();
  const offeringCount = new Map<string, number>();

  assignments.forEach((a, i) => {
    const where = `slot ${i + 1} (day ${a.day}, period ${a.periodIndex})`;
    const task = taskByOffering.get(a.offeringId);
    if (!task) {
      violations.push({
        kind: "UNKNOWN_OFFERING",
        message: `Unknown offering referenced at ${where}.`,
        offeringId: a.offeringId,
      });
      return;
    }
    const room = roomById.get(a.classroomId);
    if (!room) {
      violations.push({
        kind: "UNKNOWN_ROOM",
        message: `Unknown classroom referenced at ${where}.`,
        offeringId: a.offeringId,
      });
      return;
    }

    const fk = `${a.facultyId}|${key(a.day, a.periodIndex)}`;
    const rk = `${a.classroomId}|${key(a.day, a.periodIndex)}`;
    const bk = `${a.batchId}|${key(a.day, a.periodIndex)}`;

    if (facultySeen.has(fk)) {
      violations.push({
        kind: "FACULTY_CLASH",
        message: `Faculty is double-booked at ${where}.`,
        offeringId: a.offeringId,
        day: a.day,
        periodIndex: a.periodIndex,
      });
    } else facultySeen.set(fk, i);

    if (roomSeen.has(rk)) {
      violations.push({
        kind: "ROOM_CLASH",
        message: `Classroom is double-booked at ${where}.`,
        offeringId: a.offeringId,
        day: a.day,
        periodIndex: a.periodIndex,
      });
    } else roomSeen.set(rk, i);

    if (batchSeen.has(bk)) {
      violations.push({
        kind: "BATCH_CLASH",
        message: `Batch has two sessions at ${where}.`,
        offeringId: a.offeringId,
        day: a.day,
        periodIndex: a.periodIndex,
      });
    } else batchSeen.set(bk, i);

    if (room.capacity < task.batchStrength) {
      violations.push({
        kind: "CAPACITY",
        message: `Room ${room.code} (capacity ${room.capacity}) is too small for batch of ${task.batchStrength}.`,
        offeringId: a.offeringId,
      });
    }

    const expectedType = task.isLab ? "LAB" : "LECTURE";
    if (room.type !== expectedType) {
      violations.push({
        kind: "ROOM_TYPE",
        message: `${task.isLab ? "Lab" : "Lecture"} session placed in a ${room.type} room (${room.code}).`,
        offeringId: a.offeringId,
      });
    }

    if (!facultyAllowed(a.facultyId, a.day, a.periodIndex)) {
      violations.push({
        kind: "AVAILABILITY",
        message: `Faculty is not available at ${where}.`,
        offeringId: a.offeringId,
        day: a.day,
        periodIndex: a.periodIndex,
      });
    }

    offeringCount.set(a.offeringId, (offeringCount.get(a.offeringId) ?? 0) + 1);
  });

  for (const [offeringId, count] of offeringCount.entries()) {
    const task = taskByOffering.get(offeringId);
    if (task && count > task.sessions) {
      violations.push({
        kind: "TOO_MANY_SESSIONS",
        message: `Offering "${task.subjectLabel}" has ${count} sessions but only ${task.sessions} are required.`,
        offeringId,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
