import { requirePageRole } from "@/lib/guard";
import { getOwnProfile } from "@/lib/services/identity-service";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { ChangePasswordForm } from "@/components/forms";
import { ROLE_LABELS, Role } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export default async function AccountPage() {
  const actor = await requirePageRole("ADMIN", "FACULTY", "STUDENT");
  const profile = await getOwnProfile(actor);

  const rows: { label: string; value: string }[] = [
    { label: "Full name", value: profile.name },
    { label: "Email", value: profile.email },
    { label: "Login ID", value: profile.loginId },
    { label: "Role", value: ROLE_LABELS[profile.role as Role] },
  ];
  if (profile.student) {
    rows.push(
      { label: "Roll number", value: profile.student.rollNo },
      { label: "Department", value: profile.student.department },
      { label: "Course", value: profile.student.course ?? "—" },
      { label: "Batch", value: profile.student.batch ?? "—" },
      { label: "Admission year", value: String(profile.student.admissionYear) },
    );
  }
  if (profile.faculty) {
    rows.push(
      { label: "Employee number", value: profile.faculty.employeeNo },
      { label: "Department", value: profile.faculty.department },
      { label: "Designation", value: profile.faculty.designation },
    );
  }
  rows.push({ label: "Account created", value: formatDate(profile.createdAt) });

  return (
    <>
      <PageHeader
        title="My account"
        description="Your profile details and password settings."
      />

      {profile.mustChangePassword ? (
        <div className="mb-4">
          <Alert tone="warn" title="Please change your password">
            This account still uses its one-time password. Change it now to secure your account.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile" actions={<Badge tone={profile.isActive ? "success" : "danger"}>{profile.isActive ? "Active" : "Inactive"}</Badge>}>
          <dl className="divide-y divide-ink-100 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-ink-500">{r.label}</dt>
                <dd className="text-right font-medium text-ink-800">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-4">
          <Card title="Change password" description="You will be signed out and must sign in again.">
            <ChangePasswordForm />
          </Card>

          <Card title="Security">
            <ul className="space-y-2 text-sm text-ink-600">
              <li>• Passwords are stored only as salted hashes and are never logged.</li>
              <li>• Changing your password revokes all your active sessions.</li>
              <li>• Your sessions expire automatically after inactivity.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
