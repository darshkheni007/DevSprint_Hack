import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/current-user";
import { roleHomePath } from "@/lib/nav";

export default async function RootPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  redirect(roleHomePath(actor.role));
}
