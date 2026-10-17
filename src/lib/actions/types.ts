import { toErrorResponse } from "@/lib/errors";

export interface ActionState {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  data?: Record<string, unknown> | null;
}

export const initialActionState: ActionState = {
  ok: false,
  message: "",
  data: null,
};

/**
 * Wrap a server action body so that thrown AppErrors become safe, serialisable
 * action state. NOTE: never call `redirect()` inside `fn` — it throws a special
 * control-flow error that must propagate to Next.js, so call it afterwards.
 */
export async function runAction(
  fn: () => Promise<ActionState | void>,
): Promise<ActionState> {
  try {
    const result = await fn();
    return result ?? { ok: true, message: "Saved.", data: null };
  } catch (error) {
    const { body } = toErrorResponse(error);
    return {
      ok: false,
      message: body.message,
      fieldErrors: body.fieldErrors,
      data: null,
    };
  }
}
