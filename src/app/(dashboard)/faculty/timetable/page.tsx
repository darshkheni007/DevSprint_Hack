import { requirePageRole } from "@/lib/guard";
import { getFacultyTimetable } from "@/lib/services/timetable-service";
import {
  listCancellableSlots,
  listCancellationsForFaculty,
} from "@/lib/services/cancellation-service";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ReadOnlyTimetableGrid } from "@/components/timetable-grid";
import { CancelLectureForm } from "@/components/forms";

export default async function FacultyTimetablePage() {
  const actor = await requirePageRole("FACULTY");
  const [cells, cancellable, cancellations] = await Promise.all([
    getFacultyTimetable(actor),
    listCancellableSlots(actor),
    listCancellationsForFaculty(actor),
  ]);

  const subjects = new Set(cells.map((c) => c.subjectCode));
  const batches = new Set(cells.map((c) => c.batchName));

  return (
    <>
      <PageHeader
        title="My timetable"
        description="Your published teaching slots. Only approved and published timetables are shown."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Weekly sessions" value={cells.length} icon="calendar" />
        <StatCard label="Subjects" value={subjects.size} icon="layers" tone="neutral" />
        <StatCard label="Batches" value={batches.size} icon="users" tone="neutral" />
      </div>

      <div className="mt-4">
        <Card title="Weekly schedule">
          {cells.length === 0 ? (
            <EmptyState
              title="No published timetable"
              description="Your schedule appears once the administration publishes the timetable."
              icon="calendar"
            />
          ) : (
            <ReadOnlyTimetableGrid cells={cells} showFaculty={false} />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Cancel a lecture">
          {cancellable.length === 0 ? (
            <EmptyState
              title="No cancellable lectures"
              description="You can cancel an occurrence of any of your published lectures."
              icon="calendar"
            />
          ) : (
            <CancelLectureForm
              slots={cancellable.map((s) => ({ value: s.id, label: s.label, day: s.day }))}
            />
          )}
        </Card>

        <Card title="Cancelled lectures">
          {cancellations.length === 0 ? (
            <EmptyState
              title="Nothing cancelled"
              description="Cancelled occurrences for your lectures will be listed here."
              icon="calendar"
            />
          ) : (
            <ul className="space-y-3">
              {cancellations.map((c) => (
                <li key={c.id} className="rounded-lg border border-ink-100 p-3">
                  <p className="text-sm font-medium text-ink-700">
                    {c.subjectCode} {c.subject} — {c.date}
                  </p>
                  <p className="text-xs text-ink-500">
                    {c.batchName} · {c.classroom} · period {c.periodIndex}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Cancelled by {c.cancelledByName}
                    {c.reason ? ` · ${c.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
