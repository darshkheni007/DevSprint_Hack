import { requirePageRole } from "@/lib/guard";
import {
  getAtRiskStudents,
  getBatchAttendanceBySubject,
  getBatchMarkStats,
  getInstituteAttendance,
} from "@/lib/services/analytics-service";
import { listBatches } from "@/lib/services/academic-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { BarChart } from "@/components/charts";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string }>;
}) {
  await requirePageRole("ADMIN");
  const params = await searchParams;
  const [batches, institute, atRisk] = await Promise.all([
    listBatches(),
    getInstituteAttendance(),
    getAtRiskStudents(),
  ]);

  const batchId = params.batchId ?? batches[0]?.id ?? null;
  const [attendance, marks] = batchId
    ? await Promise.all([getBatchAttendanceBySubject(batchId), getBatchMarkStats(batchId)])
    : [[], []];

  const avgPassRate =
    marks.length > 0 ? Math.round(marks.reduce((s, m) => s + m.passRate, 0) / marks.length) : 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Attendance and performance insights by batch."
        actions={
          <form method="get" className="flex items-center gap-2">
            <select name="batchId" defaultValue={batchId ?? ""} className="input py-1.5 text-xs">
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button type="submit" className="btn-secondary py-1.5 text-xs">View batch</button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Institute attendance" value={`${institute.percent}%`} icon="clipboard" tone={institute.percent >= 75 ? "success" : "danger"} />
        <StatCard label="Avg pass rate" value={`${avgPassRate}%`} icon="award" tone={avgPassRate >= 60 ? "success" : "warn"} hint="Selected batch" />
        <StatCard label="Exams analysed" value={marks.length} icon="chart" tone="neutral" />
        <StatCard label="At-risk students" value={atRisk.length} icon="warning" tone={atRisk.length ? "warn" : "success"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Attendance by subject" description="Selected batch">
          {attendance.length === 0 ? (
            <EmptyState title="No data" icon="clipboard" />
          ) : (
            <BarChart data={attendance.map((s) => ({ label: s.subject, value: s.percent }))} />
          )}
        </Card>

        <Card title="Pass rate by exam" description="Selected batch">
          {marks.length === 0 ? (
            <EmptyState title="No marks recorded" icon="award" />
          ) : (
            <BarChart data={marks.map((m) => ({ label: m.subject, value: m.passRate }))} />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Marks statistics" description="Average, highest and lowest by exam">
          {marks.length === 0 ? (
            <EmptyState title="No marks yet" icon="chart" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Subject</th><th>Exam</th><th>Avg</th><th>High</th><th>Low</th><th>Pass</th></tr>
                </thead>
                <tbody>
                  {marks.map((m, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{m.subject}</td>
                      <td className="text-xs text-ink-600">{m.exam}</td>
                      <td className="font-medium">{m.average}</td>
                      <td>{m.highest}</td>
                      <td>{m.lowest}</td>
                      <td>
                        <Badge tone={m.passRate >= 60 ? "success" : m.passRate >= 40 ? "warn" : "danger"}>
                          {m.passRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Students needing support">
          {atRisk.length === 0 ? (
            <EmptyState title="All students meeting requirements" icon="check" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Roll No</th><th>Name</th><th>Batch</th><th>Attendance</th></tr>
                </thead>
                <tbody>
                  {atRisk.slice(0, 15).map((s) => (
                    <tr key={s.studentId}>
                      <td className="font-medium text-ink-800">{s.rollNo}</td>
                      <td>{s.name}</td>
                      <td className="text-xs text-ink-500">{s.batch}</td>
                      <td>
                        <Badge tone={s.percent < 60 ? "danger" : "warn"}>{s.percent}%</Badge>
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
