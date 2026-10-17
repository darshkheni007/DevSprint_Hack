"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticate } from "@/lib/services/auth-service";
import { changeOwnPassword } from "@/lib/services/identity-service";
import {
  endSession,
  requestMeta,
  requireCurrentActor,
  startSession,
} from "@/lib/current-user";
import { writeAudit } from "@/lib/audit";
import { loginSchema, passwordChangeSchema, formatZodError } from "@/lib/validation";
import { roleHomePath } from "@/lib/nav";
import { Role } from "@/lib/constants";
import { ActionState, runAction } from "./types";

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: formatZodError(parsed.error),
      data: null,
    };
  }

  const state = await runAction(async () => {
    const meta = await requestMeta();
    const user = await authenticate(
      parsed.data.identifier,
      parsed.data.password,
      meta,
    );
    await startSession(user.id);
    return {
      ok: true,
      message: "",
      data: { redirect: roleHomePath(user.role as Role), mustChange: user.mustChangePassword },
    };
  });

  if (state.ok && typeof state.data?.redirect === "string") {
    redirect(state.data.redirect);
  }
  return state;
}

export async function logoutAction(): Promise<void> {
  const actor = await requireCurrentActor().catch(() => null);
  await endSession();
  await writeAudit({
    actorUserId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    action: "auth.logout",
    summary: "User signed out",
  });
  redirect("/login");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form.",
      fieldErrors: formatZodError(parsed.error),
      data: null,
    };
  }

  const state = await runAction(async () => {
    const actor = await requireCurrentActor();
    await changeOwnPassword(actor, parsed.data);
    return { ok: true, message: "Password updated. Please sign in again.", data: null };
  });

  if (state.ok) {
    // All sessions were revoked; send the user back to login.
    await endSession();
    revalidatePath("/account");
    redirect("/login");
  }
  return state;
}
