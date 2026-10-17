import Link from "next/link";
import { requirePageRole } from "@/lib/guard";
import { getActiveTerm, listBatches, listClassrooms, listTerms } from "@/lib/services/academic-service";
import {
  getVersionGrid,
  listVersions,
  validateVersion,
} from "@/lib/services/timetable-service";
import { Alert, Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { GenerateTimetableForm, SlotEditForm, TimetableVersionActions } from "@/components/forms";
import { DAYS, DEFAULT_PERIODS } from "@/lib/constants";
import { statusTone, formatDateTime } from "@/lib/format";

const EDITABLE = new Set(["DRAFT", "GENERATED", "IN_REVIEW", "APPROVED"]);

/** Map a status tone to a StatCard tone ("info" becomes "brand"). */
const STAT_TONE: Record<
  "success" | "warn" | "danger" | "info" | "neutral",
  "success" | "warn" | "danger" | "brand" | "neutral"
> = {
  success: "success",
  warn: "warn",
  danger: "danger",
  info: "brand",
  neutral: "neutral",
};

export default async function AdminTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ termId?: string; versionId?: string; batchId?: string }>;
}) {
  const actor = await requirePageRole("ADMIN");
  const params = await searchParams;
  const [terms, activeTerm, classrooms, batches] = await Promise.all([
    listTerms(),
    getActiveTerm(),
    listClassrooms(),
    listBatches(),
  ]);

  if (terms.length === 0) {
    return (
      <>
        <PageHeader title="Timetable" description="Generate, review, approve and publish timetables." />
        <EmptyState title="No academic terms" description="Create an academic term before generating a timetable." icon="calendar" />
      </>
    );
  }

  const termId = params.termId ?? activeTerm?.id ?? terms[0]!.id;
  const versions = await listVersions(actor, termId);
  const selected =
    versions.find((v) => v.id === params.versionId) ?? versions[0] ?? null;

  const grid = selected ? await getVersionGrid(selected.id) : [];
  const validation = selected ? await validateVersion(selected.id) : null;

  const batchIdsInGrid = Array.from(new Set(grid.map((c) => c.batchId)));
  const batchFilter = params.batchId ?? batchIdsInGrid[0] ?? null;
  const cells = batchFilter ? grid.filter((c) => c.batchId === batchFilter) : grid;
  const roomOptions = classrooms.map((c) => ({ value: c.id, label: `${c.code} (cap ${c.capacity})` }));
  const editable = selected ? EDITABLE.has(selected.status) : false;

  const bySlot = new Map<string, typeof cells>();
  for (const c of cells) {
    const key = `${c.day}:${c.periodIndex}`;
    const arr = bySlot.get(key) ?? [];
    arr.push(c);
    bySlot.set(key, arr);
  }

  return (
    <>
      <PageHeader
        title="Timetable"
        description="A timetable is generated as a draft, reviewed and approved, then published."
        actions={
          <form method="get" className="flex items-center gap-2">
            <select name="termId" defaultValue={termId} className="input py-1.5 text-xs">
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.isActive ? " (active)" : ""}</option>
              ))}
            </select>
            <button type="submit" className="btn-secondary py-1.5 text-xs">Switch term</button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Versions" value={versions.length} icon="layers" tone="neutral" />
        <StatCard
          label="Selected status"
          value={selected ? selected.status.replace("_", " ") : "—"}
          icon="calendar"
          tone={selected ? STAT_TONE[statusTone(selected.status)] : "neutral"}
        />
        <StatCard
          label="Conflicts"
          value={validation ? validation.violations.length : 0}
          icon={validation && validation.valid ? "check" : "warning"}
          tone={validation && validation.valid ? "success" : "danger"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Generate" description="Creates a new draft version; never publishes automatically">
          <GenerateTimetableForm terms={terms.map((t) => ({ value: t.id, label: t.name }))} />
        </Card>

        <Card title="Versions" description={`For ${terms.find((t) => t.id === termId)?.name ?? "term"}`} className="lg:col-span-2">
          {versions.length === 0 ? (
            <EmptyState title="No versions yet" description="Generate the first draft timetable." icon="calendar" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/timetable?termId=${termId}&versionId=${v.id}`}
                        className={`text-sm font-medium ${selected?.id === v.id ? "text-brand-700" : "text-ink-800 hover:underline"}`}
                      >
                        Version {v.versionNumber}
                      </Link>
                      <Badge tone={statusTone(v.status)}>{v.status.replace("_", " ")}</Badge>
                      <span className="text-xs text-ink-400">{v.slots.length} slots</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      Created {formatDateTime(v.createdAt)}
                      {v.publishedAt ? ` · Published ${formatDateTime(v.publishedAt)}` : ""}
                    </p>
                  </div>
                  <TimetableVersionActions versionId={v.id} status={v.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {selected ? (
        <div className="mt-4 space-y-4">
          {validation && !validation.valid ? (
            <Alert tone="danger" title={`${validation.violations.length} unresolved conflict(s)`}>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                {validation.violations.slice(0, 6).map((v, i) => (
                  <li key={i}>{v.message}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="success" title="No conflicts detected">
              All hard constraints (faculty, room, batch, capacity, room type) are satisfied.
            </Alert>
          )}

          <Card
            title="Weekly grid"
            description={editable ? "Click Move on a slot to adjust it; edits are re-validated." : "Published/archived timetables are read-only."}
            actions={
              batchIdsInGrid.length > 0 ? (
                <form method="get" className="flex items-center gap-2">
                  <input type="hidden" name="termId" value={termId} />
                  <input type="hidden" name="versionId" value={selected.id} />
                  <select name="batchId" defaultValue={batchFilter ?? ""} className="input py-1.5 text-xs">
                    {batchIdsInGrid.map((id) => (
                      <option key={id} value={id}>
                        {batches.find((b) => b.id === id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-secondary py-1.5 text-xs">View batch</button>
                </form>
              ) : null
            }
          >
            {cells.length === 0 ? (
              <EmptyState title="No slots to display" description="This version has no slots for the selected batch." icon="calendar" />
            ) : (
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
                                    <div key={c.slotId} className="rounded-lg border border-ink-100 p-2">
                                      <p className="text-xs font-semibold text-ink-800">
                                        {c.subjectCode}
                                        {c.slotType === "LAB" ? <span className="ml-1 text-[10px] text-brand-600">LAB</span> : null}
                                      </p>
                                      <p className="text-[11px] text-ink-500">{c.facultyName}</p>
                                      <p className="text-[11px] text-ink-400">{c.classroom} · {c.batchName}</p>
                                      <div className="mt-1">
                                        <SlotEditForm
                                          versionId={selected.id}
                                          slot={{
                                            id: c.slotId,
                                            day: c.day,
                                            periodIndex: c.periodIndex,
                                            classroomId: c.classroomId,
                                            label: c.subjectCode,
                                          }}
                                          rooms={roomOptions}
                                          disabled={!editable}
                                        />
                                      </div>
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
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
