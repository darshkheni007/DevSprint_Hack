import { requirePageRole } from "@/lib/guard";
import { listMyComplaints } from "@/lib/services/feedback-service";
import { listFacultyUsers } from "@/lib/services/academic-service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ComplaintForm } from "@/components/forms";
import { formatDateTime, relativeTime, statusTone } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export default async function StudentComplaintsPage() {
  const actor = await requirePageRole("STUDENT");
  const [complaints, faculty] = await Promise.all([
    listMyComplaints(actor),
    listFacultyUsers(),
  ]);

  return (
    <>
      <PageHeader
        title="Feedback & complaints"
        description="Report a campus issue and give feedback. Anonymous feedback never reveals your identity."
      />

      <Card title="Submit" description="Faculty feedback is visible only to administrators.">
        <ComplaintForm
          faculty={faculty.map((f) => ({ value: f.id, label: `${f.firstName} ${f.lastName}` }))}
        />
      </Card>

      <div className="mt-4">
        <Card title={`My complaints (${complaints.length})`}>
          {complaints.length === 0 ? (
            <EmptyState title="No complaints submitted" description="Your complaints and responses will appear here." icon="inbox" />
          ) : (
            <ul className="space-y-4">
              {complaints.map((c) => (
                <li key={c.id} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{c.subject}</p>
                      <p className="text-xs text-ink-500">{c.category} · {relativeTime(c.createdAt)}</p>
                    </div>
                    <Badge tone={statusTone(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-600">{c.message}</p>
                  {c.responses.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-l-2 border-brand-200 pl-3">
                      {c.responses.map((r) => (
                        <li key={r.id} className="text-xs text-ink-600">
                          <span className="font-medium text-ink-700">Administration</span> · {formatDateTime(r.createdAt)}
                          <p className="mt-0.5 whitespace-pre-line">{r.message}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
