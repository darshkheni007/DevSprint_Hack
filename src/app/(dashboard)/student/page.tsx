import Link from "next/link";
import { requirePageRole } from "@/lib/guard";
import { getStudentOverview } from "@/lib/services/analytics-service";
import { getMyAttendance } from "@/lib/services/attendance-service";
import { listAssignments } from "@/lib/services/assignment-service";
import { listNotices } from "@/lib/services/notice-service";
import { Alert, Badge, Card, EmptyState, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/format";

export default async function StudentDashboard() {
  const actor = await requirePageRole("STUDENT");
  const [overview, attendance, assignments, notices] = await Promise.all([
    getStudentOverview(actor),
    getMyAttendance(actor),
    listAssignments(actor),
    listNotices(actor),
  ]);
  if (!overview) return null;

  const openAssignments = assignments.filter((a) => a.deadline.getTime() >= Date.now());

  return (
    <>
      <PageHeader
        title={`Hi, ${actor.name.split(" ")[0]}`}
        description="Your attendance, results and campus updates."
        actions={<Link href="/assistant" className="btn-secondary">Ask the assistant</Link>}
      />

      {overview.belowThreshold ? (
        <div className="mb-4">
          <Alert tone="danger" title="Attendance below the requirement">
            Your attendance is {overview.attendance}%, below the required {overview.threshold}%.
            Please attend classes regularly to stay eligible.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My attendance"
          value={`${overview.attendance}%`}
          icon="clipboard"
          tone={overview.belowThreshold ? "danger" : "success"}
          hint={`${overview.attendancePresent}/${overview.attendanceTotal} classes`}
        />
        <StatCard label="Average score" value={`${overview.averageMark}%`} icon="award" tone="neutral" hint={`${overview.resultsCount} published results`} />
        <StatCard label="Open assignments" value={openAssignments.length} icon="file" tone="warn" hint={`${overview.assignments} total`} />
        <StatCard label="Library books out" value={overview.activeBorrows} icon="book" tone="neutral" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Attendance by subject"
          description={`Requirement: ${overview.threshold}%`}
          className="lg:col-span-2"
          actions={<Link href="/student/attendance" className="text-xs font-medium text-brand-600 hover:underline">Details</Link>}
        >
          {attendance.summaries.length === 0 ? (
            <EmptyState title="No attendance recorded yet" icon="clipboard" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Present</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.summaries.map((s) => (
                    <tr key={s.offeringId}>
                      <td>
                        <p className="font-medium text-ink-800">{s.subjectCode}</p>
                        <p className="text-xs text-ink-500">{s.subject}</p>
                      </td>
                      <td className="text-ink-600">
                        {s.present}/{s.total}
                      </td>
                      <td>
                        <ProgressBar percent={s.percent} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Assignments"
          actions={<Link href="/student/assignments" className="text-xs font-medium text-brand-600 hover:underline">All</Link>}
        >
          {openAssignments.length === 0 ? (
            <EmptyState title="Nothing due" description="You have no open assignments." icon="check" />
          ) : (
            <ul className="space-y-3">
              {openAssignments.slice(0, 5).map((a) => (
                <li key={a.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-ink-800">{a.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{a.subjectCode} · {a.maxMarks} marks</p>
                  <p className="mt-1 text-[11px] text-ink-400">Due {formatDateTime(a.deadline)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Recent notices" actions={<Link href="/student/notices" className="text-xs font-medium text-brand-600 hover:underline">All</Link>}>
          {notices.length === 0 ? (
            <EmptyState title="No notices" />
          ) : (
            <ul className="space-y-3">
              {notices.slice(0, 5).map((n) => (
                <li key={n.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink-800">{n.title}</p>
                    <Badge tone="info">{n.audience}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{relativeTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Quick links">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { href: "/student/timetable", label: "Timetable", icon: "calendar" },
                { href: "/student/results", label: "Results", icon: "award" },
                { href: "/student/library", label: "Library", icon: "book" },
                { href: "/student/complaints", label: "Complaints", icon: "inbox" },
              ] as const
            ).map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2.5 text-sm text-ink-700 hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="text-brand-600">•</span>
                {q.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
