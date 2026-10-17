import { requirePageRole } from "@/lib/guard";
import { listNotices } from "@/lib/services/notice-service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { relativeTime } from "@/lib/format";

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Everyone",
  STUDENT: "All students",
  COURSE: "Course",
  BATCH: "My batch",
  FACULTY: "Faculty",
  ADMIN: "Administrators",
};

export default async function StudentNoticesPage() {
  const actor = await requirePageRole("STUDENT");
  const notices = await listNotices(actor);

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements for you, your course and your batch."
      />

      <Card title={`Notices (${notices.length})`}>
        {notices.length === 0 ? (
          <EmptyState title="No notices yet" icon="megaphone" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {notices.map((n) => (
              <li key={n.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-800">{n.title}</p>
                  <Badge tone="info">{AUDIENCE_LABELS[n.audience] ?? n.audience}</Badge>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{n.body}</p>
                <p className="mt-1.5 text-[11px] text-ink-400">{relativeTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
