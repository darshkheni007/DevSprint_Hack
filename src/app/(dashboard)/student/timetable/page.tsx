import { requirePageRole } from "@/lib/guard";
import { getStudentTimetable } from "@/lib/services/timetable-service";
import { listCancellationsForStudent } from "@/lib/services/cancellation-service";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ReadOnlyTimetableGrid } from "@/components/timetable-grid";

export default async function StudentTimetablePage() {
  const actor = await requirePageRole("STUDENT");
  const [{ cells }, cancellations] = await Promise.all([
    getStudentTimetable(actor),
    listCancellationsForStudent(actor),
  ]);

  const subjects = new Set(cells.map((c) => c.subjectCode));
  const faculty = new Set(cells.map((c) => c.facultyName));

  return (
    <>
      <PageHeader
        title="My timetable"
        description="Your published class schedule for the current term."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Weekly classes" value={cells.length} icon="calendar" />
        <StatCard label="Subjects" value={subjects.size} icon="layers" tone="neutral" />
        <StatCard label="Faculty" value={faculty.size} icon="user" tone="neutral" />
      </div>

      <div className="mt-4">
        <Card title="Weekly schedule">
          {cells.length === 0 ? (
            <EmptyState
              title="No published timetable yet"
              description="Your schedule will appear here once the administration publishes it."
              icon="calendar"
            />
          ) : (
            <ReadOnlyTimetableGrid cells={cells} showFaculty />
          )}
        </Card>
      </div>

      {cancellations.length > 0 ? (
        <div className="mt-4">
          <Card title="Cancelled lectures">
            <ul className="space-y-3">
              {cancellations.map((c) => (
                <li key={c.id} className="rounded-lg border border-danger-500/30 bg-danger-50 p-3">
                  <p className="text-sm font-medium text-danger-700">
                    {c.subjectCode} {c.subject} — {c.date}
                  </p>
                  <p className="text-xs text-ink-500">
                    period {c.periodIndex} · {c.classroom}
                    {c.reason ? ` · ${c.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}
