import Link from "next/link";
import { requirePageRole } from "@/lib/guard";
import {
  getAdminOverview,
  getAtRiskStudents,
  getAttendanceTrend,
} from "@/lib/services/analytics-service";
import { listNotices } from "@/lib/services/notice-service";
import { Card, EmptyState, PageHeader, StatCard, Badge } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { formatDate, relativeTime } from "@/lib/format";

export default async function AdminDashboard() {
  const actor = await requirePageRole("ADMIN");
  const [overview, trend, atRisk, notices] = await Promise.all([
    getAdminOverview(),
    getAttendanceTrend(),
    getAtRiskStudents(),
    listNotices(actor),
  ]);

  const trendPoints = trend.slice(-12).map((t) => ({
    label: formatDate(t.date).slice(0, 6),
    value: t.percent,
  }));

  return (
    <>
      <PageHeader
        title={`Welcome, ${actor.name.split(" ")[0]}`}
        description="Institution-wide overview of academics, attendance and services."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={overview.students} icon="users" hint={`${overview.batches} batches`} />
        <StatCard label="Faculty" value={overview.faculty} icon="user" tone="neutral" hint={`${overview.subjects} subjects`} />
        <StatCard
          label="Institute attendance"
          value={`${overview.attendance.percent}%`}
          icon="clipboard"
          tone={overview.attendance.percent >= overview.threshold ? "success" : "danger"}
          hint={`Threshold ${overview.threshold}%`}
        />
        <StatCard
          label="Open complaints"
          value={overview.openComplaints}
          icon="inbox"
          tone={overview.openComplaints > 0 ? "warn" : "success"}
          hint="Awaiting response"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Attendance trend"
          description="Institute-wide attendance by teaching day"
          className="lg:col-span-2"
        >
          <LineChart data={trendPoints} />
        </Card>

        <Card title="System snapshot">
          <dl className="space-y-3 text-sm">
            {[
              { label: "Courses", value: overview.courses },
              { label: "Classrooms", value: overview.classrooms },
              { label: "Published timetables", value: overview.publishedTimetables },
              { label: "Notices", value: overview.notices },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <dt className="text-ink-500">{row.label}</dt>
                <dd className="font-semibold text-ink-800">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/timetable" className="btn-primary">Manage timetable</Link>
            <Link href="/admin/analytics" className="btn-secondary">Analytics</Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Students needing support"
          description="Below the attendance threshold"
          className="lg:col-span-2"
        >
          {atRisk.length === 0 ? (
            <EmptyState title="No students below the threshold" description="Everyone is meeting the attendance requirement." icon="check" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Batch</th>
                    <th>Attendance</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.slice(0, 8).map((s) => (
                    <tr key={s.studentId}>
                      <td className="font-medium text-ink-800">{s.rollNo}</td>
                      <td>{s.name}</td>
                      <td>{s.batch}</td>
                      <td>
                        <Badge tone={s.percent < 60 ? "danger" : "warn"}>{s.percent}%</Badge>
                      </td>
                      <td className="text-xs text-ink-500">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recent notices" actions={<Link href="/admin/notices" className="text-xs font-medium text-brand-600 hover:underline">All</Link>}>
          {notices.length === 0 ? (
            <EmptyState title="No notices yet" />
          ) : (
            <ul className="space-y-3">
              {notices.slice(0, 5).map((n) => (
                <li key={n.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-ink-800">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-400">
                    {n.audience} · {relativeTime(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
