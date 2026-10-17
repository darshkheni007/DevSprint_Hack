import { requirePageRole } from "@/lib/guard";
import { listExams } from "@/lib/services/marks-service";
import {
  listBatches,
  listClassrooms,
  listSubjects,
  listTerms,
} from "@/lib/services/academic-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ExamForm, PublishResultsForm } from "@/components/forms";
import { formatDate } from "@/lib/format";

export default async function AdminExamsPage() {
  const actor = await requirePageRole("ADMIN");
  const [exams, subjects, batches, terms, classrooms] = await Promise.all([
    listExams(actor),
    listSubjects(),
    listBatches(),
    listTerms(),
    listClassrooms(),
  ]);

  const published = exams.filter((e) => e.resultPublished).length;

  return (
    <>
      <PageHeader
        title="Examinations"
        description="Schedule exams, review marks entry and publish results."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Exams" value={exams.length} icon="award" tone="neutral" />
        <StatCard label="Results published" value={published} icon="check" tone="success" />
        <StatCard label="Pending publication" value={exams.length - published} icon="clock" tone={exams.length - published > 0 ? "warn" : "success"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Schedule exam" className="lg:col-span-2">
          <ExamForm
            subjects={subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
            batches={batches.map((b) => ({ value: b.id, label: b.name }))}
            terms={terms.map((t) => ({ value: t.id, label: t.name }))}
            classrooms={classrooms.map((c) => ({ value: c.id, label: `${c.code} (cap ${c.capacity})` }))}
          />
        </Card>

        <Card title={`Exams (${exams.length})`} className="lg:col-span-3">
          {exams.length === 0 ? (
            <EmptyState title="No exams scheduled" description="Schedule an exam to begin." icon="award" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Exam</th><th>Subject</th><th>Batch</th><th>Date</th><th>Marks</th><th>Results</th></tr>
                </thead>
                <tbody>
                  {exams.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-ink-800">{e.name}</td>
                      <td className="font-mono text-xs">{e.subject.code}</td>
                      <td className="text-xs">{e.batch.name}</td>
                      <td className="text-xs text-ink-500">{formatDate(e.examDate)}</td>
                      <td className="text-xs">{e._count.marks}/{e.batch.strength}</td>
                      <td>
                        {e.resultPublished ? (
                          <Badge tone="success">Published</Badge>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge tone="warn">Pending</Badge>
                            <PublishResultsForm examId={e.id} />
                          </div>
                        )}
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
