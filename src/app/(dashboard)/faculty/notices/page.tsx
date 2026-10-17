import { requirePageRole } from "@/lib/guard";
import { listNotices } from "@/lib/services/notice-service";
import { listBatches, listCourses } from "@/lib/services/academic-service";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { NoticeForm } from "@/components/forms";
import { relativeTime } from "@/lib/format";

export default async function FacultyNoticesPage() {
  const actor = await requirePageRole("FACULTY");
  const [notices, courses, batches] = await Promise.all([
    listNotices(actor),
    listCourses(),
    listBatches(),
  ]);

  return (
    <>
      <PageHeader
        title="Notices"
        description="Post notices for the courses and batches you teach, and read institution announcements."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          title="Post a notice"
          description="Faculty may post notices for their own courses and batches."
          className="lg:col-span-2"
        >
          <NoticeForm
            audiences={[
              { value: "BATCH", label: "Batch" },
              { value: "COURSE", label: "Course" },
            ]}
            courses={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
            batches={batches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Card>

        <Card title={`Visible notices (${notices.length})`} className="lg:col-span-3">
          {notices.length === 0 ? (
            <EmptyState title="No notices" icon="megaphone" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {notices.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-800">{n.title}</p>
                    <Badge tone="info">{n.audience}</Badge>
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
