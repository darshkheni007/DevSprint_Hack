import type { SolverAssignment } from "./solver";

/**
 * Pure helpers for faculty lecture swaps.
 *
 * A swap exchanges the time position (day + periodIndex) of two published
 * timetable slots. Each slot keeps its own offering/batch/faculty/classroom, so
 * the invariant `slot.facultyId === offering.facultyId` (which attendance and
 * marks authorization rely on) is preserved.
 */
export interface SwapSlotLike {
  id: string;
  offeringId: string;
  batchId: string;
  facultyId: string;
  classroomId: string;
  day: number;
  periodIndex: number;
  slotType: string;
}

/**
 * Build the hypothetical assignment list in which the two slots have exchanged
 * their time position. Feed this to `validateSchedule` to check the proposed
 * swap against every hard constraint before persisting anything.
 */
export function buildSwappedAssignments(
  slots: SwapSlotLike[],
  requesterSlotId: string,
  recipientSlotId: string,
): SolverAssignment[] {
  const a = slots.find((s) => s.id === requesterSlotId);
  const b = slots.find((s) => s.id === recipientSlotId);
  if (!a || !b) {
    throw new Error("Both slots must exist in the same timetable version.");
  }
  return slots.map((s) => {
    let day = s.day;
    let periodIndex = s.periodIndex;
    if (s.id === requesterSlotId) {
      day = b.day;
      periodIndex = b.periodIndex;
    } else if (s.id === recipientSlotId) {
      day = a.day;
      periodIndex = a.periodIndex;
    }
    return {
      offeringId: s.offeringId,
      batchId: s.batchId,
      facultyId: s.facultyId,
      classroomId: s.classroomId,
      day,
      periodIndex,
      slotType: s.slotType === "LAB" ? "LAB" : "LECTURE",
    };
  });
}

/** True when two slots already occupy the same time position. */
export function occupySameTime(a: SwapSlotLike, b: SwapSlotLike): boolean {
  return a.day === b.day && a.periodIndex === b.periodIndex;
}
