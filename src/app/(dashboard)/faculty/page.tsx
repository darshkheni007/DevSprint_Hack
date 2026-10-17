import Link from "next/link";
import { requirePageRole } from "@/lib/guard";
import { getFacultyOverview } from "@/lib/services/analytics-service";
import { listAssignments } from "@/lib/services/assignment-service";
import { listNotices } from "@/lib/services/notice-service";
import { Card, EmptyState, PageHeader, StatCard, Badge, ProgressBar } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/format";

export default async function FacultyDashboard() {
  const actor = await requirePageRole("FACULTY");
  const [overview, assignments, notices] = await Promise.all([
    getFacultyOverview(actor),
    listAssignments(actor),
    listNotices(actor),
  ]);
  if (!overview) return null;

  const upcoming = assignments
    .filter((a) => a.deadline.getTime() >= Date.now() - 864e5)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Welcome, ${actor.name.split(" ")[0]}`}
        description="Your teaching load, sessions and assignments at a glance."
        actions={
          <>
            <Link href="/faculty/attendance" className="btn-primary">Record attendance</Link>
            <Link href="/faculty/marks" className="btn-secondary">Enter marks</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Offerings" value={overview.offerings} icon="layers" hint={`${overview.batches} batch(es)`} />
        <StatCard label="Sessions taken" value={overview.sessions} icon="clipboard" tone="neutral" />
        <StatCard
          label="Attendance"
          value={`${overview.attendancePercent}%`}
          icon="check"
          tone={overview.attendancePercent >= 75 ? "success" : "warn"}
          hint="Across your subjects"
        />
        <StatCard label="Weekly slots" value={overview.weeklySlots} icon="calendar" tone="neutral" hint={`${overview.assignments} assignments`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="My subjects" description="Subjects and batches you teach this term">
          {overview.subjects.length === 0 ? (
            <EmptyState title="No offerings assigned" description="The administrator assigns subjects to faculty." icon="layers" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {overview.subjects.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800">
                      {s.code} · {s.name}
                    </p>
                    <p className="text-xs text-ink-500">{s.batch}</p>
                  </div>
                  <Link href="/faculty/attendance" className="text-xs font-medium text-brand-600 hover:underline">
                    Attendance
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Assignments"
          description="Nearest deadlines across your subjects"
          actions={<Link href="/faculty/assignments" className="text-xs font-medium text-brand-600 hover:underline">Manage</Link>}
        >
          {upcoming.length === 0 ? (
            <EmptyState title="No assignments yet" description="Create an assignment for one of your subjects." icon="file" />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((a) => (
                <li key={a.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">{a.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {a.subjectCode} · {a.batchName} · {a.maxMarks} marks
                      </p>
                    </div>
                    <Badge tone={a.deadline.getTime() < Date.now() ? "danger" : "info"}>
                      {a.deadline.getTime() < Date.now() ? "Past" : "Open"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-400">Due {formatDateTime(a.deadline)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card title="My timetable load" description="Weekly teaching slots">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { label: "Sessions per week", value: overview.weeklySlots },
                { label: "Subjects", value: overview.offerings },
                { label: "Batches", value: overview.batches },
              ] as const
            ).map((m) => (
              <div key={m.label} className="rounded-lg border border-ink-100 p-3">
                <p className="text-xs text-ink-500">{m.label}</p>
                <p className="mt-1 text-lg font-semibold text-ink-900">{m.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs text-ink-500">Attendance satisfaction</p>
            <ProgressBar percent={overview.attendancePercent} />
          </div>
          <div className="mt-4">
            <Link href="/faculty/timetable" className="btn-secondary">View my timetable</Link>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Notices" actions={<Link href="/faculty/notices" className="text-xs font-medium text-brand-600 hover:underline">All</Link>}>
          {notices.length === 0 ? (
            <EmptyState title="No notices" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {notices.slice(0, 4).map((n) => (
                <li key={n.id} className="rounded-lg border border-ink-100 p-3">
                  <p className="text-sm font-medium text-ink-800">{n.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{n.audience} · {relativeTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
