import { requirePageRole } from "@/lib/guard";
import {
  getAtRiskStudents,
  getAttendanceTrend,
  getBatchAttendanceBySubject,
  getInstituteAttendance,
} from "@/lib/services/analytics-service";
import { listBatches } from "@/lib/services/academic-service";
import { getAttendanceThreshold } from "@/lib/settings";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { BarChart, LineChart } from "@/components/charts";
import { formatDate } from "@/lib/format";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string }>;
}) {
  await requirePageRole("ADMIN");
  const params = await searchParams;
  const [institute, trend, atRisk, batches, threshold] = await Promise.all([
    getInstituteAttendance(),
    getAttendanceTrend(),
    getAtRiskStudents(),
    listBatches(),
    getAttendanceThreshold(),
  ]);

  const batchId = params.batchId ?? batches[0]?.id ?? null;
  const bySubject = batchId ? await getBatchAttendanceBySubject(batchId) : [];

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`Institute-wide attendance and per-subject breakdown. Requirement: ${threshold}%.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Institute attendance"
          value={`${institute.percent}%`}
          icon="clipboard"
          tone={institute.percent >= threshold ? "success" : "danger"}
          hint={`${institute.present}/${institute.total} records`}
        />
        <StatCard label="Batches" value={batches.length} icon="layers" tone="neutral" />
        <StatCard
          label="Below threshold"
          value={atRisk.length}
          icon="warning"
          tone={atRisk.length > 0 ? "warn" : "success"}
          hint={`Requirement ${threshold}%`}
        />
        <StatCard
          label="Teaching days"
          value={trend.length}
          icon="calendar"
          tone="neutral"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Attendance trend" description="Institute-wide attendance by teaching day">
          <LineChart data={trend.slice(-12).map((t) => ({ label: formatDate(t.date).slice(0, 6), value: t.percent }))} />
        </Card>

        <Card
          title="Attendance by subject"
          description={batchId ? `Batch: ${batches.find((b) => b.id === batchId)?.name ?? ""}` : "Select a batch"}
          actions={
            <form method="get" className="flex items-center gap-2">
              <select name="batchId" defaultValue={batchId ?? ""} className="input py-1.5 text-xs">
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button type="submit" className="btn-secondary py-1.5 text-xs">View</button>
            </form>
          }
        >
          {bySubject.length === 0 ? (
            <EmptyState title="No attendance data" description="Record attendance to see subject-wise percentages." icon="clipboard" />
          ) : (
            <BarChart data={bySubject.map((s) => ({ label: s.subject, value: s.percent }))} />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Students needing support" description="Attendance below the configured threshold">
          {atRisk.length === 0 ? (
            <EmptyState title="No students below the threshold" icon="check" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Roll No</th><th>Name</th><th>Batch</th><th>Attendance</th></tr>
                </thead>
                <tbody>
                  {atRisk.map((s) => (
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
