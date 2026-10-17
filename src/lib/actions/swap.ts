"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import * as svc from "@/lib/services/swap-service";
import {
  formatZodError,
  swapDecisionSchema,
  swapRequestSchema,
} from "@/lib/validation";
import { ActionState, runAction } from "./types";

function invalid(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { ok: false, message, fieldErrors, data: null };
}

/** Shared invalidation for anything that can change a faculty/student timetable. */
function revalidateTimetableViews() {
  revalidatePath("/faculty/swaps");
  revalidatePath("/faculty/timetable");
  revalidatePath("/student/timetable");
  revalidatePath("/admin/timetable");
  revalidatePath("/notifications");
  revalidatePath("/faculty");
}

export async function createSwapRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = swapRequestSchema.safeParse({
    requesterSlotId: formData.get("requesterSlotId"),
    recipientSlotId: formData.get("recipientSlotId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return invalid("Please choose both lectures.", formatZodError(parsed.error));
  }
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await svc.createSwapRequest(actor, parsed.data);
    revalidateTimetableViews();
    return {
      ok: true,
      message: "Swap request sent. The other faculty member must accept before anything changes.",
      data: null,
    };
  });
}

export async function decideSwapAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = swapDecisionSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    return invalid("That swap action is not valid.", formatZodError(parsed.error));
  }
  return runAction(async () => {
    const actor = await requireCurrentActor();
    const result = await svc.decideSwap(actor, parsed.data);
    revalidateTimetableViews();
    return {
      ok: true,
      message:
        result.status === "FINALIZED"
          ? "Swap accepted and applied to the published timetable."
          : "Swap request declined. The timetable is unchanged.",
      data: { status: result.status },
    };
  });
}

export async function cancelSwapRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return invalid("Missing swap request.");
  return runAction(async () => {
    const actor = await requireCurrentActor();
    await svc.cancelSwapRequest(actor, requestId);
    revalidateTimetableViews();
    return { ok: true, message: "Swap request withdrawn.", data: null };
  });
}
