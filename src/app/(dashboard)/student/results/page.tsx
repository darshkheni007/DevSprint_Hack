import { requirePageRole } from "@/lib/guard";
import { getMyResults } from "@/lib/services/marks-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatDate } from "@/lib/format";

export default async function StudentResultsPage() {
  const actor = await requirePageRole("STUDENT");
  const results = await getMyResults(actor);

  const average =
    results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.percent, 0) / results.length)
      : 0;
  const best = results.reduce((m, r) => Math.max(m, r.percent), 0);

  return (
    <>
      <PageHeader
        title="My results"
        description="Only published results are visible. Results are released by the administration."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Average" value={`${average}%`} icon="award" tone={average >= 60 ? "success" : "warn"} />
        <StatCard label="Best score" value={`${best}%`} icon="chart" tone="neutral" />
        <StatCard label="Published results" value={results.length} icon="file" tone="neutral" />
      </div>

      <div className="mt-4">
        <Card title="Published results">
          {results.length === 0 ? (
            <EmptyState
              title="No published results yet"
              description="Results appear here once the administration publishes them."
              icon="award"
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Subject</th><th>Exam</th><th>Marks</th><th>Percent</th><th>Date</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.examId}>
                      <td>
                        <p className="font-medium text-ink-800">{r.subjectCode}</p>
                        <p className="text-xs text-ink-500">{r.subject}</p>
                      </td>
                      <td className="text-xs text-ink-600">{r.examName}</td>
                      <td className="font-medium">{r.marks} / {r.maxMarks}</td>
                      <td>{r.percent}%</td>
                      <td className="text-xs text-ink-500">{formatDate(r.examDate)}</td>
                      <td>
                        <Badge tone={r.percent >= 40 ? "success" : "danger"}>
                          {r.percent >= 40 ? "Pass" : "Fail"}
                        </Badge>
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
