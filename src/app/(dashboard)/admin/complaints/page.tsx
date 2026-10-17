import { requirePageRole } from "@/lib/guard";
import { listAllComplaints, listAllFeedback } from "@/lib/services/feedback-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { RespondComplaintForm } from "@/components/forms";
import { COMPLAINT_STATUSES } from "@/lib/constants";
import { formatDateTime, relativeTime, statusTone } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export default async function AdminComplaintsPage() {
  const actor = await requirePageRole("ADMIN");
  const [complaints, feedback] = await Promise.all([
    listAllComplaints(actor),
    listAllFeedback(actor),
  ]);

  const open = complaints.filter((c) => c.status === "SUBMITTED" || c.status === "IN_REVIEW").length;

  return (
    <>
      <PageHeader
        title="Feedback & complaints"
        description="Respond to student complaints and review faculty feedback. Anonymous feedback never reveals the submitter."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Complaints" value={complaints.length} icon="inbox" tone="neutral" />
        <StatCard label="Open" value={open} icon="clock" tone={open > 0 ? "warn" : "success"} />
        <StatCard label="Feedback items" value={feedback.length} icon="megaphone" tone="neutral" />
      </div>

      <div className="mt-4 space-y-4">
        <Card title={`Complaints (${complaints.length})`}>
          {complaints.length === 0 ? (
            <EmptyState title="No complaints" icon="check" />
          ) : (
            <ul className="space-y-4">
              {complaints.map((c) => (
                <li key={c.id} className="rounded-lg border border-ink-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{c.subject}</p>
                      <p className="text-xs text-ink-500">
                        {c.category} · {c.student.firstName} {c.student.lastName} ({c.student.loginId}) · {relativeTime(c.createdAt)}
                      </p>
                    </div>
                    <Badge tone={statusTone(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-600">{c.message}</p>

                  {c.responses.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-l-2 border-brand-200 pl-3">
                      {c.responses.map((r) => (
                        <li key={r.id} className="text-xs text-ink-600">
                          <span className="font-medium text-ink-700">
                            {r.admin.firstName} {r.admin.lastName}
                          </span>{" "}
                          · {formatDateTime(r.createdAt)}
                          <p className="mt-0.5 whitespace-pre-line">{r.message}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 border-t border-ink-100 pt-3">
                    <RespondComplaintForm
                      complaintId={c.id}
                      currentStatus={c.status}
                      statuses={COMPLAINT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Faculty feedback (${feedback.length})`} description="Latest 100 items">
          {feedback.length === 0 ? (
            <EmptyState title="No feedback yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Subject</th><th>Faculty</th><th>Feedback</th><th>Type</th><th>When</th></tr>
                </thead>
                <tbody>
                  {feedback.map((f) => (
                    <tr key={f.id}>
                      <td className="font-medium text-ink-800">{f.subject}</td>
                      <td className="text-xs text-ink-600">{f.facultyName}</td>
                      <td className="max-w-md text-xs text-ink-600">{f.message}</td>
                      <td>
                        <Badge tone={f.isAnonymous ? "neutral" : "info"}>
                          {f.isAnonymous ? "Anonymous" : "Named"}
                        </Badge>
                      </td>
                      <td className="text-xs text-ink-400">{relativeTime(f.createdAt)}</td>
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
