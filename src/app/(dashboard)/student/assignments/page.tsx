import { requirePageRole } from "@/lib/guard";
import { listAssignments } from "@/lib/services/assignment-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export default async function StudentAssignmentsPage() {
  const actor = await requirePageRole("STUDENT");
  const assignments = await listAssignments(actor);

  const open = assignments.filter((a) => a.deadline.getTime() >= Date.now());
  const closed = assignments.filter((a) => a.deadline.getTime() < Date.now());

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Assignments for your batch, ordered by deadline."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={open.length} icon="file" tone={open.length ? "warn" : "success"} />
        <StatCard label="Closed" value={closed.length} icon="check" tone="neutral" />
        <StatCard label="Total" value={assignments.length} icon="layers" tone="neutral" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {assignments.length === 0 ? (
          <Card title="No assignments">
            <EmptyState title="You have no assignments" description="Check back later." icon="file" />
          </Card>
        ) : (
          assignments.map((a) => {
            const isOpen = a.deadline.getTime() >= Date.now();
            return (
              <Card key={a.id} title={a.title} description={`${a.subjectName} · ${a.batchName}`}>
                <p className="whitespace-pre-line text-sm text-ink-600">{a.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={isOpen ? "info" : "neutral"}>{isOpen ? "Open" : "Closed"}</Badge>
                  <Badge tone="neutral">{a.maxMarks} marks</Badge>
                  <span className="text-xs text-ink-500">Due {formatDateTime(a.deadline)}</span>
                </div>
                <p className="mt-2 text-[11px] text-ink-400">{a.facultyName}</p>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
