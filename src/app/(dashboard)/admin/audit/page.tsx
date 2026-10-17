import { requirePageRole } from "@/lib/guard";
import { listAuditLog } from "@/lib/audit";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export default async function AdminAuditPage() {
  await requirePageRole("ADMIN");
  const entries = await listAuditLog(150);

  const denied = entries.filter((e) => e.result === "DENIED").length;
  const failures = entries.filter((e) => e.result === "FAILURE").length;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of sensitive actions. Entries are never edited or deleted."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Entries shown" value={entries.length} icon="shield" tone="neutral" />
        <StatCard label="Denied" value={denied} icon="warning" tone={denied ? "warn" : "success"} />
        <StatCard label="Failures" value={failures} icon="x" tone={failures ? "danger" : "success"} />
      </div>

      <div className="mt-4">
        <Card title="Recent activity">
          {entries.length === 0 ? (
            <EmptyState title="No audit entries yet" icon="shield" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(e.timestamp)}</td>
                      <td className="text-xs">
                        {e.actor ? (
                          <span className="text-ink-700">
                            {e.actor.firstName} {e.actor.lastName}
                            <span className="ml-1 text-ink-400">({e.actorRole ?? e.actor.role})</span>
                          </span>
                        ) : (
                          <span className="text-ink-400">System</span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-ink-700">{e.action}</td>
                      <td className="text-xs text-ink-500">{e.entityType ?? "—"}</td>
                      <td className="max-w-sm text-xs text-ink-600">{e.summary ?? "—"}</td>
                      <td>
                        <Badge tone={e.result === "SUCCESS" ? "success" : e.result === "DENIED" ? "danger" : "warn"}>
                          {e.result}
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
