import { requirePageRole } from "@/lib/guard";
import { listUsers } from "@/lib/services/identity-service";
import { listBatches, listDepartments } from "@/lib/services/academic-service";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { CreateUserForm, UserActiveToggle } from "@/components/forms";
import { ROLE_LABELS, Role } from "@/lib/constants";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const actor = await requirePageRole("ADMIN");
  const params = await searchParams;
  const [users, departments, batches] = await Promise.all([
    listUsers(actor),
    listDepartments(),
    listBatches(),
  ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const q = (params.q ?? "").trim().toLowerCase();
  const roleFilter = params.role ?? "";

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (!q) return true;
    return (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.loginId.toLowerCase().includes(q)
    );
  });

  const counts = {
    students: users.filter((u) => u.role === "STUDENT").length,
    faculty: users.filter((u) => u.role === "FACULTY").length,
    admins: users.filter((u) => u.role === "ADMIN").length,
    inactive: users.filter((u) => !u.isActive).length,
  };

  return (
    <>
      <PageHeader
        title="Students & Faculty"
        description="Create and manage accounts. Accounts are created by administrators only."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={counts.students} icon="users" />
        <StatCard label="Faculty" value={counts.faculty} icon="user" tone="neutral" />
        <StatCard label="Administrators" value={counts.admins} icon="shield" tone="neutral" />
        <StatCard label="Inactive" value={counts.inactive} icon="warning" tone={counts.inactive ? "warn" : "success"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card title="Create account" description="A one-time password is shown after creation" className="lg:col-span-2">
          <CreateUserForm
            departments={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
            batches={batches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Card>

        <div className="lg:col-span-3">
          <Card
            title={`Accounts (${filtered.length})`}
            actions={
              <form className="flex items-center gap-2" method="get">
                <input
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Search name, email, ID"
                  className="input w-44 py-1.5 text-xs"
                />
                <select name="role" defaultValue={roleFilter} className="input py-1.5 text-xs">
                  <option value="">All roles</option>
                  <option value="STUDENT">Students</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="ADMIN">Admins</option>
                </select>
                <button type="submit" className="btn-secondary py-1.5 text-xs">Filter</button>
              </form>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState title="No accounts match" description="Try a different search or filter." icon="users" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Login ID</th>
                      <th>Role</th>
                      <th>Batch / Dept</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 100).map((u) => (
                      <tr key={u.id}>
                        <td>
                          <p className="font-medium text-ink-800">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-ink-500">{u.email}</p>
                        </td>
                        <td className="font-mono text-xs">{u.loginId}</td>
                        <td>
                          <Badge tone={u.role === "ADMIN" ? "info" : u.role === "FACULTY" ? "neutral" : "success"}>
                            {ROLE_LABELS[u.role as Role]}
                          </Badge>
                        </td>
                        <td className="text-xs text-ink-600">
                          {u.studentProfile
                            ? (u.studentProfile.batch?.name ?? "—")
                            : u.facultyProfile
                              ? (deptName.get(u.facultyProfile.departmentId) ?? "—")
                              : "—"}
                        </td>
                        <td>
                          <Badge tone={u.isActive ? "success" : "danger"}>
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="text-right">
                          {u.id === actor.id ? (
                            <span className="text-xs text-ink-400">You</span>
                          ) : (
                            <UserActiveToggle userId={u.id} isActive={u.isActive} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
