"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/current-user";
import { answer } from "@/lib/services/ai-service";
import { ASSISTANT_QUESTION_MAX, assistantSchema, formatZodError } from "@/lib/validation";
import { ActionState, runAction } from "./types";

export async function askAssistantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = assistantSchema.safeParse({
    question: formData.get("question"),
  });
  if (!parsed.success) {
    // Distinguish "too long" from "empty" so the message is actually useful.
    const tooLong = parsed.error.issues.some((issue) => issue.code === "too_big");
    return {
      ok: false,
      message: tooLong
        ? `Please shorten your question to ${ASSISTANT_QUESTION_MAX} characters or fewer.`
        : "Please type a question.",
      fieldErrors: formatZodError(parsed.error),
      data: null,
    };
  }
  return runAction(async () => {
    const actor = await requireCurrentActor();
    const result = await answer(actor, parsed.data.question);
    revalidatePath("/assistant");
    return {
      ok: true,
      message: "",
      data: {
        question: parsed.data.question,
        answer: result.answer,
        sources: result.sources,
        intent: result.intent,
        refused: result.refused,
        via: result.via,
        model: result.model ?? null,
        fallbackReason: result.fallbackReason ?? null,
      },
    };
  });
}
