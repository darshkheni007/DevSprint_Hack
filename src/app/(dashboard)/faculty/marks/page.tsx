import Link from "next/link";
import { requirePageRole } from "@/lib/guard";
import { getExamMarks, listExams } from "@/lib/services/marks-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { EnterMarksForm } from "@/components/forms";
import { formatDate } from "@/lib/format";

export default async function FacultyMarksPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>;
}) {
  const actor = await requirePageRole("FACULTY");
  const params = await searchParams;
  const exams = await listExams(actor);
  const selectedExam = exams.find((e) => e.id === params.examId) ?? exams[0] ?? null;

  const detail = selectedExam ? await getExamMarks(actor, selectedExam.id) : null;
  const existing: Record<string, number> = {};
  if (detail) {
    for (const s of detail.students) {
      if (s.marks !== null) existing[s.studentId] = s.marks;
    }
  }

  return (
    <>
      <PageHeader
        title="Marks & exams"
        description="Enter or update marks for your subjects. Results are published by the administration."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Your exams" value={exams.length} icon="award" tone="neutral" />
        <StatCard label="Students" value={detail?.students.length ?? 0} icon="users" tone="neutral" />
        <StatCard
          label="Marks entered"
          value={detail ? detail.students.filter((s) => s.marks !== null).length : 0}
          icon="check"
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title={`Exams (${exams.length})`} className="lg:col-span-2">
          {exams.length === 0 ? (
            <EmptyState title="No exams for your subjects" description="Exams are scheduled by the administration." icon="award" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {exams.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/faculty/marks?examId=${e.id}`}
                    className={`flex items-center justify-between gap-2 py-2.5 text-sm ${
                      selectedExam?.id === e.id ? "font-medium text-brand-700" : "text-ink-700 hover:text-brand-600"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{e.name}</span>
                      <span className="block text-xs text-ink-500">
                        {e.subject.code} · {e.batch.name} · {formatDate(e.examDate)}
                      </span>
                    </span>
                    <Badge tone={e.resultPublished ? "success" : "warn"}>
                      {e.resultPublished ? "Published" : "Draft"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={selectedExam ? `Enter marks — ${selectedExam.name}` : "Enter marks"}
          description={selectedExam ? `Max ${selectedExam.maxMarks} marks · ${selectedExam.batch.name}` : undefined}
          className="lg:col-span-3"
        >
          {!detail ? (
            <EmptyState title="Select an exam" icon="award" />
          ) : detail.students.length === 0 ? (
            <EmptyState title="No students in this batch" icon="users" />
          ) : (
            <EnterMarksForm
              examId={detail.exam.id}
              maxMarks={detail.exam.maxMarks}
              students={detail.students.map((s) => ({
                studentId: s.studentId,
                rollNo: s.rollNo,
                name: s.name,
              }))}
              existing={existing}
            />
          )}
        </Card>
      </div>
    </>
  );
}
