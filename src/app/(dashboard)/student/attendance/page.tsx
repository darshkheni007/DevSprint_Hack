import { requirePageRole } from "@/lib/guard";
import { getMyAttendance } from "@/lib/services/attendance-service";
import { getAttendanceThreshold } from "@/lib/settings";
import { Alert, Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard } from "@/components/ui";

export default async function StudentAttendancePage() {
  const actor = await requirePageRole("STUDENT");
  const [data, threshold] = await Promise.all([
    getMyAttendance(actor),
    getAttendanceThreshold(),
  ]);
  const { summaries, overall } = data;
  const below = overall.hasData && overall.percent < threshold;

  return (
    <>
      <PageHeader
        title="My attendance"
        description={`Attendance across all your subjects. Requirement: ${threshold}%.`}
      />

      {below ? (
        <div className="mb-4">
          <Alert tone="danger" title="Below requirement">
            Your overall attendance is {overall.percent}%, below the required {threshold}%.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Overall attendance"
          value={`${overall.percent}%`}
          icon="clipboard"
          tone={below ? "danger" : overall.hasData ? "success" : "neutral"}
        />
        <StatCard label="Classes attended" value={overall.present} icon="check" tone="neutral" hint={`of ${overall.total}`} />
        <StatCard label="Subjects" value={summaries.length} icon="layers" tone="neutral" />
      </div>

      <div className="mt-4">
        <Card title="Subject-wise attendance">
          {summaries.length === 0 ? (
            <EmptyState title="No attendance recorded yet" icon="clipboard" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Subject</th><th>Present</th><th>Total</th><th>Attendance</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.offeringId}>
                      <td>
                        <p className="font-medium text-ink-800">{s.subjectCode}</p>
                        <p className="text-xs text-ink-500">{s.subject}</p>
                      </td>
                      <td>{s.present}</td>
                      <td>{s.total}</td>
                      <td><ProgressBar percent={s.percent} /></td>
                      <td>
                        <Badge tone={s.percent >= threshold ? "success" : s.percent >= threshold - 10 ? "warn" : "danger"}>
                          {s.percent >= threshold ? "OK" : "Low"}
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
