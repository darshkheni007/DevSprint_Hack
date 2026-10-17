import { DAYS, DEFAULT_PERIODS } from "@/lib/constants";

export interface GridCell {
  slotId: string;
  day: number;
  periodIndex: number;
  subjectCode: string;
  subject: string;
  facultyName: string;
  classroom: string;
  batchName: string;
  slotType: string;
  /** True when this recurring slot has at least one cancelled occurrence. */
  cancelled?: boolean;
}

/**
 * Read-only weekly grid shared by the faculty and student timetables.
 * Cells are grouped per working day (Mon–Sat) and period (P1–P6).
 */
export function ReadOnlyTimetableGrid({
  cells,
  showFaculty = true,
}: {
  cells: GridCell[];
  showFaculty?: boolean;
}) {
  const bySlot = new Map<string, GridCell[]>();
  for (const c of cells) {
    const key = `${c.day}:${c.periodIndex}`;
    const arr = bySlot.get(key) ?? [];
    arr.push(c);
    bySlot.set(key, arr);
  }

  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[54rem]">
        <thead>
          <tr>
            <th className="w-20">Period</th>
            {DAYS.map((d) => (
              <th key={d.value}>{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEFAULT_PERIODS.map((p) => (
            <tr key={p.index}>
              <td className="align-top text-xs text-ink-500">
                <span className="font-semibold text-ink-700">{p.label}</span>
                <br />
                {p.startTime}
              </td>
              {DAYS.map((d) => {
                const cell = bySlot.get(`${d.value}:${p.index}`) ?? [];
                return (
                  <td key={d.value} className="align-top">
                    <div className="space-y-2">
                      {cell.length === 0 ? (
                        <span className="text-xs text-ink-300">—</span>
                      ) : (
                        cell.map((c) => (
                          <div
                            key={c.slotId}
                            className={
                              c.cancelled
                                ? "rounded-lg border border-danger-500/40 bg-danger-50 p-2"
                                : "rounded-lg border border-ink-100 p-2"
                            }
                          >
                            <p className="text-xs font-semibold text-ink-800">
                              {c.subjectCode}
                              {c.slotType === "LAB" ? (
                                <span className="ml-1 text-[10px] text-brand-600">LAB</span>
                              ) : null}
                              {c.cancelled ? (
                                <span className="ml-1 rounded bg-danger-500/15 px-1 text-[10px] font-semibold text-danger-700">
                                  CANCELLED
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-[11px] text-ink-500">{c.subject}</p>
                            {showFaculty ? (
                              <p className="truncate text-[11px] text-ink-400">{c.facultyName}</p>
                            ) : null}
                            <p className="text-[11px] text-ink-400">
                              {c.classroom}
                              {showFaculty ? "" : ` · ${c.batchName}`}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
