"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import { prisma } from "@/lib/db";

/** Mark every notification for the current user as read. */
export async function markAllReadAction(): Promise<void> {
  const actor = await requireCurrentActor();
  await prisma.notification.updateMany({
    where: { userId: actor.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/faculty");
  revalidatePath("/student");
}

/** Mark a single notification as read (ownership enforced by userId filter). */
export async function markReadAction(formData: FormData): Promise<void> {
  const actor = await requireCurrentActor();
  const id = String(formData.get("notificationId") ?? "");
  if (!id) return;
  await prisma.notification.updateMany({
    where: { id, userId: actor.id },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}
