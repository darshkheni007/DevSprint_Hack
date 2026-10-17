/**
 * Deterministic timetable solver (M05, D-006).
 *
 * Strategy: build session "tasks" from subject offerings, order the hardest
 * first (labs, then large batches), then place them with backtracking under the
 * hard constraints. A bounded local-search pass then reduces idle gaps.
 *
 * Guarantees relevant to the requirements:
 *  - Deterministic: no randomness; identical inputs produce identical output.
 *  - Never emits an invalid schedule: every placement is checked against the
 *    same hard constraints the independent validator uses.
 *  - If it cannot place everything within its node budget it returns the best
 *    partial placement PLUS structured conflicts and suggestions (M05-R08).
 */

export type RoomType = "LECTURE" | "LAB";

export interface SolverTask {
  offeringId: string;
  subjectLabel: string;
  batchId: string;
  batchStrength: number;
  facultyId: string;
  facultyName: string;
  isLab: boolean;
  sessions: number;
}

export interface SolverRoom {
  id: string;
  code: string;
  capacity: number;
  type: RoomType;
}

export interface SolverInput {
  tasks: SolverTask[];
  rooms: SolverRoom[];
  days: number[];
  periods: number[];
  /** facultyId -> set of allowed "day:period" keys. Missing = fully available. */
  availability: Map<string, Set<string>>;
  /** Optional node budget for the backtracking search. */
  maxNodes?: number;
}

export interface SolverAssignment {
  offeringId: string;
  batchId: string;
  facultyId: string;
  classroomId: string;
  day: number;
  periodIndex: number;
  slotType: RoomType;
}

export interface SolverConflict {
  offeringId: string;
  subjectLabel: string;
  batchId: string;
  facultyId: string;
  message: string;
  suggestion: string;
}

export interface SoftScore {
  /** Total idle gaps (empty periods between a batch's first and last class). */
  idleGaps: number;
  /** Spread of sessions per day across faculty (lower is more balanced). */
  workloadImbalance: number;
}

export interface SolverResult {
  assignments: SolverAssignment[];
  conflicts: SolverConflict[];
  satisfied: boolean;
  score: SoftScore;
  nodesExplored: number;
}

const DEFAULT_MAX_NODES = 200_000;

function slotKey(day: number, period: number): string {
  return `${day}:${period}`;
}

function isFacultyAvailable(
  input: SolverInput,
  facultyId: string,
  day: number,
  period: number,
): boolean {
  const allowed = input.availability.get(facultyId);
  if (!allowed) return true; // no restriction recorded => available
  return allowed.has(slotKey(day, period));
}

/** Order units hardest-first: labs, then bigger batches, then more sessions. */
function expandUnits(tasks: SolverTask[]): SolverTask[] {
  const units: SolverTask[] = [];
  const ordered = [...tasks].sort((a, b) => {
    if (a.isLab !== b.isLab) return a.isLab ? -1 : 1;
    if (a.batchStrength !== b.batchStrength) return b.batchStrength - a.batchStrength;
    if (a.sessions !== b.sessions) return b.sessions - a.sessions;
    return a.offeringId < b.offeringId ? -1 : a.offeringId > b.offeringId ? 1 : 0;
  });
  for (const task of ordered) {
    for (let i = 0; i < task.sessions; i++) units.push(task);
  }
  return units;
}

interface Ctx {
  input: SolverInput;
  assigned: SolverAssignment[];
  facultyBusy: Set<string>;
  roomBusy: Set<string>;
  batchBusy: Set<string>;
  nodes: number;
  maxNodes: number;
}

function placeableRooms(ctx: Ctx, task: SolverTask): SolverRoom[] {
  return ctx.input.rooms
    .filter((room) => {
      if (room.capacity < task.batchStrength) return false;
      if (task.isLab) return room.type === "LAB";
      return room.type === "LECTURE";
    })
    .sort((a, b) => a.capacity - b.capacity || (a.code < b.code ? -1 : 1));
}

interface Placement {
  day: number;
  period: number;
  room: SolverRoom;
}

/** Deterministically enumerate feasible placements for one unit. */
function candidatePlacements(ctx: Ctx, task: SolverTask): Placement[] {
  const out: Placement[] = [];
  const rooms = placeableRooms(ctx, task);
  if (rooms.length === 0) return out;
  for (const day of ctx.input.days) {
    for (const period of ctx.input.periods) {
      if (ctx.facultyBusy.has(`${task.facultyId}|${slotKey(day, period)}`)) continue;
      if (ctx.batchBusy.has(`${task.batchId}|${slotKey(day, period)}`)) continue;
      if (!isFacultyAvailable(ctx.input, task.facultyId, day, period)) continue;
      for (const room of rooms) {
        if (ctx.roomBusy.has(`${room.id}|${slotKey(day, period)}`)) continue;
        out.push({ day, period, room });
        break; // smallest feasible room for this slot is enough to try first
      }
    }
  }
  return out;
}

function tryAssign(ctx: Ctx, task: SolverTask, p: Placement): void {
  ctx.assigned.push({
    offeringId: task.offeringId,
    batchId: task.batchId,
    facultyId: task.facultyId,
    classroomId: p.room.id,
    day: p.day,
    periodIndex: p.period,
    slotType: task.isLab ? "LAB" : "LECTURE",
  });
  ctx.facultyBusy.add(`${task.facultyId}|${slotKey(p.day, p.period)}`);
  ctx.roomBusy.add(`${p.room.id}|${slotKey(p.day, p.period)}`);
  ctx.batchBusy.add(`${task.batchId}|${slotKey(p.day, p.period)}`);
}

function unassign(ctx: Ctx): void {
  const a = ctx.assigned.pop()!;
  ctx.facultyBusy.delete(`${a.facultyId}|${slotKey(a.day, a.periodIndex)}`);
  ctx.roomBusy.delete(`${a.classroomId}|${slotKey(a.day, a.periodIndex)}`);
  ctx.batchBusy.delete(`${a.batchId}|${slotKey(a.day, a.periodIndex)}`);
}

/** Backtracking placement with a bounded search and best-partial tracking. */
function backtrack(
  ctx: Ctx,
  units: SolverTask[],
  index: number,
  best: { count: number; snapshot: SolverAssignment[] },
): boolean {
  if (index >= units.length) return true;
  if (ctx.nodes >= ctx.maxNodes) return false;
  if (ctx.assigned.length > best.count) {
    best.count = ctx.assigned.length;
    best.snapshot = [...ctx.assigned];
  }
  const task = units[index]!;
  for (const p of candidatePlacements(ctx, task)) {
    if (ctx.nodes >= ctx.maxNodes) break;
    ctx.nodes++;
    tryAssign(ctx, task, p);
    if (backtrack(ctx, units, index + 1, best)) return true;
    unassign(ctx);
  }
  return false;
}

/** Soft score: fewer idle gaps and more even workload is better. */
export function computeSoftScore(
  assignments: SolverAssignment[],
  days: number[],
): SoftScore {
  // Idle gaps per batch per day.
  const byBatchDay = new Map<string, number[]>();
  for (const a of assignments) {
    const key = `${a.batchId}|${a.day}`;
    const arr = byBatchDay.get(key) ?? [];
    arr.push(a.periodIndex);
    byBatchDay.set(key, arr);
  }
  let idleGaps = 0;
  for (const periods of byBatchDay.values()) {
    periods.sort((x, y) => x - y);
    for (let i = 1; i < periods.length; i++) {
      idleGaps += Math.max(0, periods[i]! - periods[i - 1]! - 1);
    }
  }

  // Workload imbalance: standard deviation of sessions per (faculty,day).
  const facultyDay = new Map<string, number>();
  for (const a of assignments) {
    const key = `${a.facultyId}|${a.day}`;
    facultyDay.set(key, (facultyDay.get(key) ?? 0) + 1);
  }
  const daysWithLoad = days.length;
  const loads = new Map<string, number>();
  for (const key of facultyDay.keys()) {
    const facultyId = key.split("|")[0]!;
    loads.set(facultyId, (loads.get(facultyId) ?? 0) + facultyDay.get(key)!);
  }
  let imbalance = 0;
  for (const total of loads.values()) {
    const avgPerDay = total / daysWithLoad;
    imbalance += avgPerDay;
  }
  // Imbalance metric: variance of per-day load across faculty.
  const perFaculty = new Map<string, number[]>();
  for (const [key, count] of facultyDay.entries()) {
    const facultyId = key.split("|")[0]!;
    const arr = perFaculty.get(facultyId) ?? [];
    arr.push(count);
    perFaculty.set(facultyId, arr);
  }
  let varianceSum = 0;
  for (const arr of perFaculty.values()) {
    const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
    varianceSum += arr.reduce((s, n) => s + (n - mean) ** 2, 0);
  }
  return { idleGaps, workloadImbalance: Math.round(varianceSum * 100) / 100 };
}

/**
 * Deterministic local search: try to pull a session earlier in the same day to
 * close an idle gap, when the move keeps every hard constraint satisfied.
 */
function reduceGaps(
  ctx: Ctx,
  assignment: SolverAssignment,
  all: SolverAssignment[],
): boolean {
  const daySlotsForBatch = all
    .filter((a) => a.batchId === assignment.batchId && a.day === assignment.day)
    .map((a) => a.periodIndex);
  const minPeriod = Math.min(...daySlotsForBatch);
  if (assignment.periodIndex <= minPeriod) return false;

  for (let target = minPeriod; target < assignment.periodIndex; target++) {
    if (all.some((a) => a.batchId === assignment.batchId && a.day === assignment.day && a.periodIndex === target)) {
      continue;
    }
    if (ctx.facultyBusy.has(`${assignment.facultyId}|${slotKey(assignment.day, target)}`)) continue;
    if (ctx.roomBusy.has(`${assignment.classroomId}|${slotKey(assignment.day, target)}`)) continue;
    if (!isFacultyAvailable(ctx.input, assignment.facultyId, assignment.day, target)) continue;

    ctx.assigned = ctx.assigned.filter((a) => a !== assignment);
    ctx.facultyBusy.delete(`${assignment.facultyId}|${slotKey(assignment.day, assignment.periodIndex)}`);
    ctx.roomBusy.delete(`${assignment.classroomId}|${slotKey(assignment.day, assignment.periodIndex)}`);
    ctx.batchBusy.delete(`${assignment.batchId}|${slotKey(assignment.day, assignment.periodIndex)}`);

    assignment.periodIndex = target;
    ctx.assigned.push(assignment);
    ctx.facultyBusy.add(`${assignment.facultyId}|${slotKey(assignment.day, target)}`);
    ctx.roomBusy.add(`${assignment.classroomId}|${slotKey(assignment.day, target)}`);
    ctx.batchBusy.add(`${assignment.batchId}|${slotKey(assignment.day, target)}`);

    // Replace in the flat list too.
    const idx = all.indexOf(assignment);
    if (idx >= 0) all[idx] = assignment;
    return true;
  }
  return false;
}

function buildConflicts(
  units: SolverTask[],
  assignments: SolverAssignment[],
  input: SolverInput,
): SolverConflict[] {
  const placed = new Map<string, number>();
  for (const a of assignments) {
    placed.set(a.offeringId, (placed.get(a.offeringId) ?? 0) + 1);
  }
  const remaining = new Map<string, SolverTask>();
  for (const u of units) {
    const need = u.sessions;
    const have = placed.get(u.offeringId) ?? 0;
    if (have < need) remaining.set(u.offeringId, u);
  }

  const conflicts: SolverConflict[] = [];
  for (const task of remaining.values()) {
    const hasLabRoom = input.rooms.some(
      (r) => r.type === "LAB" && r.capacity >= task.batchStrength,
    );
    const hasLectureRoom = input.rooms.some(
      (r) => r.type === "LECTURE" && r.capacity >= task.batchStrength,
    );
    let suggestion =
      "Add more classrooms or reduce the number of weekly sessions for this offering.";
    if (task.isLab && !hasLabRoom) {
      suggestion = `Add a LAB room with capacity >= ${task.batchStrength}.`;
    } else if (!task.isLab && !hasLectureRoom) {
      suggestion = `Add a lecture room with capacity >= ${task.batchStrength}.`;
    } else if (input.availability.has(task.facultyId)) {
      suggestion = `Increase availability for ${task.facultyName} (currently restricted).`;
    }
    conflicts.push({
      offeringId: task.offeringId,
      subjectLabel: task.subjectLabel,
      batchId: task.batchId,
      facultyId: task.facultyId,
      message: `Could not place all ${task.sessions} weekly session(s) for "${task.subjectLabel}" without a clash.`,
      suggestion,
    });
  }
  return conflicts;
}

export function solve(input: SolverInput): SolverResult {
  const units = expandUnits(input.tasks);
  const ctx: Ctx = {
    input,
    assigned: [],
    facultyBusy: new Set(),
    roomBusy: new Set(),
    batchBusy: new Set(),
    nodes: 0,
    maxNodes: input.maxNodes ?? DEFAULT_MAX_NODES,
  };
  const best = { count: 0, snapshot: [] as SolverAssignment[] };

  const complete = backtrack(ctx, units, 0, best);
  let assignments = complete ? [...ctx.assigned] : best.snapshot;

  if (!complete) {
    // Greedy repair: place as many remaining units as possible so that an
    // infeasible input still yields a maximal VALID partial schedule plus
    // structured diagnostics, never an invalid schedule.
    const repair: Ctx = {
      input,
      assigned: [],
      facultyBusy: new Set(),
      roomBusy: new Set(),
      batchBusy: new Set(),
      nodes: 0,
      maxNodes: 0,
    };
    for (const u of units) {
      const placements = candidatePlacements(repair, u);
      if (placements.length > 0) tryAssign(repair, u, placements[0]!);
    }
    if (repair.assigned.length > assignments.length) {
      assignments = [...repair.assigned];
    }
  }

  // Local search: bounded, deterministic gap reduction.
  const searchCtx: Ctx = {
    input,
    assigned: [...assignments],
    facultyBusy: new Set(),
    roomBusy: new Set(),
    batchBusy: new Set(),
    nodes: 0,
    maxNodes: 0,
  };
  for (const a of searchCtx.assigned) {
    searchCtx.facultyBusy.add(`${a.facultyId}|${slotKey(a.day, a.periodIndex)}`);
    searchCtx.roomBusy.add(`${a.classroomId}|${slotKey(a.day, a.periodIndex)}`);
    searchCtx.batchBusy.add(`${a.batchId}|${slotKey(a.day, a.periodIndex)}`);
  }
  const flat = searchCtx.assigned;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const a of [...flat]) {
      if (reduceGaps(searchCtx, a, flat)) changed = true;
    }
    if (!changed) break;
  }
  assignments = flat;

  const conflicts = complete ? [] : buildConflicts(units, assignments, input);
  return {
    assignments,
    conflicts,
    satisfied: complete && conflicts.length === 0,
    score: computeSoftScore(assignments, input.days),
    nodesExplored: ctx.nodes,
  };
}
