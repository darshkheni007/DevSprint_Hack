import { requirePageRole } from "@/lib/guard";
import { listNotices } from "@/lib/services/notice-service";
import { listBatches, listCourses } from "@/lib/services/academic-service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { NoticeForm } from "@/components/forms";
import { NOTICE_AUDIENCES } from "@/lib/constants";
import { relativeTime } from "@/lib/format";

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Everyone",
  ADMIN: "Administrators",
  FACULTY: "Faculty",
  STUDENT: "All students",
  COURSE: "Course",
  BATCH: "Batch",
};

export default async function AdminNoticesPage() {
  const actor = await requirePageRole("ADMIN");
  const [notices, courses, batches] = await Promise.all([
    listNotices(actor),
    listCourses(),
    listBatches(),
  ]);

  return (
    <>
      <PageHeader
        title="Notices"
        description="Publish announcements to everyone, a course or a specific batch. Recipients are notified."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Publish notice" className="lg:col-span-2">
          <NoticeForm
            audiences={NOTICE_AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] ?? a }))}
            courses={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            batches={batches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Card>

        <Card title={`Published (${notices.length})`} className="lg:col-span-3">
          {notices.length === 0 ? (
            <EmptyState title="No notices published" icon="megaphone" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {notices.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-800">{n.title}</p>
                    <Badge tone="info">{AUDIENCE_LABELS[n.audience] ?? n.audience}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{relativeTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
