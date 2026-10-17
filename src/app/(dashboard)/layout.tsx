import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/current-user";
import { getUnreadCount } from "@/lib/notifications";
import { navForRole, roleHomePath } from "@/lib/nav";
import { AppShell } from "@/components/app-shell";
import { Role } from "@/lib/constants";

/**
 * Authenticated shell. Every page under this layout is protected: an
 * unauthenticated visitor is redirected to /login (AC-M01-07).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  const role = actor.role as Role;
  const unread = await getUnreadCount(actor.id);

  return (
    <AppShell
      sections={navForRole(role)}
      user={{ name: actor.name, role, email: actor.email }}
      unread={unread}
      home={roleHomePath(role)}
    >
      {children}
    </AppShell>
  );
}
