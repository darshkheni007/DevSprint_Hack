import Link from "next/link";
import { requirePageRole } from "@/lib/guard";
import { listNotifications } from "@/lib/notifications";
import { markAllReadAction, markReadAction } from "@/lib/actions/notifications";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { relativeTime } from "@/lib/format";

export default async function NotificationsPage() {
  const actor = await requirePageRole("ADMIN", "FACULTY", "STUDENT");
  const notifications = await listNotifications(actor.id);
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about timetables, assignments, results, notices and services."
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <button type="submit" className="btn-secondary">Mark all as read</button>
            </form>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={notifications.length} icon="bell" tone="neutral" />
        <StatCard label="Unread" value={unread} icon="bell" tone={unread ? "warn" : "success"} />
        <StatCard label="Shown" value={notifications.length} icon="inbox" tone="neutral" hint="latest 50" />
      </div>

      <div className="mt-4">
        <Card title="Your notifications">
          {notifications.length === 0 ? (
            <EmptyState title="No notifications" description="You're all caught up." icon="check" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-ink-200" : "bg-brand-500"}`}
                        aria-hidden="true"
                      />
                      <p className={`text-sm ${n.isRead ? "text-ink-600" : "font-semibold text-ink-800"}`}>
                        {n.title}
                      </p>
                      <Badge tone={n.isRead ? "neutral" : "info"}>{n.type}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-500">{n.body}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-[11px] text-ink-400">{relativeTime(n.createdAt)}</span>
                      {n.link ? (
                        <Link href={n.link} className="text-[11px] font-medium text-brand-600 hover:underline">
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {!n.isRead ? (
                    <form action={markReadAction} className="shrink-0">
                      <input type="hidden" name="notificationId" value={n.id} />
                      <button type="submit" className="btn-ghost text-xs">Mark read</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
