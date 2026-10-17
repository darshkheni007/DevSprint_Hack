import { describe, it, expect } from "vitest";
import { computeAttendancePercent } from "@/lib/services/attendance-service";

describe("computeAttendancePercent (M06-R05)", () => {
  it("treats an empty record set as 0% with no data", () => {
    expect(computeAttendancePercent([])).toEqual({
      present: 0,
      total: 0,
      percent: 0,
      hasData: false,
    });
  });

  it("returns 100% when every session is present", () => {
    const records = [{ status: "PRESENT" }, { status: "PRESENT" }, { status: "PRESENT" }];
    expect(computeAttendancePercent(records)).toEqual({
      present: 3,
      total: 3,
      percent: 100,
      hasData: true,
    });
  });

  it("returns 0% but hasData when every session is absent", () => {
    const records = [{ status: "ABSENT" }, { status: "ABSENT" }];
    expect(computeAttendancePercent(records)).toEqual({
      present: 0,
      total: 2,
      percent: 0,
      hasData: true,
    });
  });

  it("rounds the percentage to the nearest integer", () => {
    const records = [
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
    ]; // 2/3 = 66.67 -> 67
    expect(computeAttendancePercent(records).percent).toBe(67);
  });

  it("ignores any status other than PRESENT when counting", () => {
    const records = [
      { status: "PRESENT" },
      { status: "ABSENT" },
      { status: "UNKNOWN" },
      { status: "PRESENT" },
    ];
    const result = computeAttendancePercent(records);
    expect(result.present).toBe(2);
    expect(result.total).toBe(4);
    expect(result.percent).toBe(50);
  });
});
