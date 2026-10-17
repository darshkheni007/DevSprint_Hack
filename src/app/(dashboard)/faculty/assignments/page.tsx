import { requirePageRole } from "@/lib/guard";
import { listAssignments, listMyOfferings } from "@/lib/services/assignment-service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { AssignmentForm } from "@/components/forms";
import { formatDateTime } from "@/lib/format";

export default async function FacultyAssignmentsPage() {
  const actor = await requirePageRole("FACULTY");
  const [assignments, offerings] = await Promise.all([
    listAssignments(actor),
    listMyOfferings(actor),
  ]);

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Create assignments for your subjects; students in the batch are notified."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Create assignment" className="lg:col-span-2">
          {offerings.length === 0 ? (
            <EmptyState title="No offerings assigned" icon="layers" />
          ) : (
            <AssignmentForm
              offerings={offerings.map((o) => ({
                value: o.id,
                label: `${o.subject.code} — ${o.batch.name}`,
              }))}
            />
          )}
        </Card>

        <Card title={`Your assignments (${assignments.length})`} className="lg:col-span-3">
          {assignments.length === 0 ? (
            <EmptyState title="No assignments yet" description="Create your first assignment." icon="file" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {assignments.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-800">{a.title}</p>
                    <Badge tone={a.deadline.getTime() < Date.now() ? "danger" : "info"}>
                      {a.deadline.getTime() < Date.now() ? "Closed" : "Open"}
                    </Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{a.description}</p>
                  <p className="mt-1 text-[11px] text-ink-400">
                    {a.subjectCode} · {a.batchName} · {a.maxMarks} marks · Due {formatDateTime(a.deadline)}
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
