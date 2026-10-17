import { requirePageRole } from "@/lib/guard";
import { getAttendanceThreshold } from "@/lib/settings";
import { Alert, Card, PageHeader, StatCard } from "@/components/ui";
import { ThresholdForm } from "@/components/forms";

export default async function AdminSettingsPage() {
  await requirePageRole("ADMIN");
  const threshold = await getAttendanceThreshold();

  const idle = process.env.SESSION_IDLE_MINUTES ?? "60";
  const absolute = process.env.SESSION_ABSOLUTE_MINUTES ?? "480";

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configuration for attendance rules and sessions."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Attendance threshold" value={`${threshold}%`} icon="settings" />
        <StatCard label="Session idle timeout" value={`${idle} min`} icon="clock" tone="neutral" />
        <StatCard label="Session max length" value={`${absolute} min`} icon="shield" tone="neutral" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Attendance requirement" description="Students below this value are flagged in dashboards and analytics.">
          <ThresholdForm current={threshold} />
        </Card>

        <Card title="Security notes">
          <ul className="space-y-2 text-sm text-ink-600">
            <li>• Accounts are created by administrators only; new users receive a one-time password and must change it.</li>
            <li>• Sessions are server-side and revoked on logout, password change or deactivation.</li>
            <li>• Every sensitive action is written to the append-only audit log.</li>
            <li>• Timetables must be approved before they can be published.</li>
          </ul>
          <div className="mt-4">
            <Alert tone="info" title="Session configuration">
              Timeouts are read from environment variables and applied on the server. Update them in the deployment environment.
            </Alert>
          </div>
        </Card>
      </div>
    </>
  );
}
