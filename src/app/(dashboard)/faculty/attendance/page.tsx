import Link from "next/link";
import { requirePageRole } from "@/lib/guard";
import { listFacultySessions } from "@/lib/services/attendance-service";
import { listMyOfferings } from "@/lib/services/assignment-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { CreateSessionForm } from "@/components/forms";
import { DAYS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export default async function FacultyAttendancePage() {
  const actor = await requirePageRole("FACULTY");
  const [offerings, sessions] = await Promise.all([
    listMyOfferings(actor),
    listFacultySessions(actor),
  ]);

  const fullyMarked = sessions.filter((s) => s.marked >= s.batchStrength).length;

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Create a class session, then mark students present or absent."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sessions" value={sessions.length} icon="clipboard" tone="neutral" />
        <StatCard label="Offerings" value={offerings.length} icon="layers" tone="neutral" />
        <StatCard label="Fully marked" value={fullyMarked} icon="check" tone="success" hint={`of ${sessions.length}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="New class session" className="lg:col-span-2">
          {offerings.length === 0 ? (
            <EmptyState
              title="No offerings assigned"
              description="Ask the administrator to assign you a subject offering."
              icon="layers"
            />
          ) : (
            <CreateSessionForm
              offerings={offerings.map((o) => ({
                value: o.id,
                label: `${o.subject.code} — ${o.batch.name}`,
              }))}
            />
          )}
        </Card>

        <Card title={`Recent sessions (${sessions.length})`} className="lg:col-span-3">
          {sessions.length === 0 ? (
            <EmptyState title="No sessions yet" description="Create a session to record attendance." icon="clipboard" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Subject</th><th>Batch</th><th>Period</th><th>Marked</th><th /></tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap text-xs text-ink-600">
                        {formatDate(s.date)}
                        <span className="ml-1 text-ink-400">
                          ({DAYS.find((d) => d.value === s.day)?.short ?? s.day})
                        </span>
                      </td>
                      <td className="font-mono text-xs">{s.subjectCode}</td>
                      <td className="text-xs">{s.batchName}</td>
                      <td className="text-xs">P{s.periodIndex}</td>
                      <td>
                        <Badge tone={s.marked >= s.batchStrength ? "success" : s.marked > 0 ? "warn" : "neutral"}>
                          {s.marked}/{s.batchStrength}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/faculty/attendance/${s.id}`}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          {s.marked > 0 ? "Update" : "Mark"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
