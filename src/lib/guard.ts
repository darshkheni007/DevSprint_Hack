import { redirect } from "next/navigation";
import { getCurrentActor } from "./current-user";
import { Role } from "./constants";
import { roleHomePath } from "./nav";
import type { Actor } from "./permissions";

/**
 * Page-level role guard. Redirects unauthenticated visitors to /login and
 * sends a signed-in user away from sections that are not theirs. This is
 * defence in depth — the services still re-check every action server-side.
 */
export async function requirePageRole(...roles: Role[]): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (roles.length > 0 && !roles.includes(actor.role as Role)) {
    redirect(roleHomePath(actor.role as Role));
  }
  return actor;
}
