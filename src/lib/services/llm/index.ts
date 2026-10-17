/**
 * Provider-agnostic entry point for the AI assistant.
 *
 * The rest of the app depends only on `generateAnswer()` and the `LlmFailure`
 * shape; adding another provider means adding an adapter and a `case` below.
 */
import { readLlmConfig } from "./config";
import { callGroq } from "./groq";
import type { LlmFailure, LlmMessage } from "./groq";

export { readLlmConfig, describeLlm, LLM_PROVIDERS } from "./config";
export type { LlmProvider, UnsafeLlmConfig, LlmConfigResult } from "./config";
export { callGroq } from "./groq";
export type { LlmMessage, LlmFailure, LlmCallResult } from "./groq";

export type LlmAnswerResult =
  | { ok: true; content: string; provider: string; model: string }
  | { ok: false; failure: LlmFailure };

/**
 * Generate an answer from the configured provider.
 *
 * Returns a discriminated result instead of throwing: the assistant always has
 * a retrieval-only path to fall back to, so a provider outage must never break
 * the page.
 */
export async function generateAnswer(
  messages: LlmMessage[],
  fetchImpl?: typeof fetch,
): Promise<LlmAnswerResult> {
  const resolved = readLlmConfig();
  if (!resolved.ok) {
    return { ok: false, failure: { kind: "not_configured" } };
  }

  const { config } = resolved;
  const result =
    config.provider === "groq"
      ? await callGroq(config, messages, fetchImpl)
      : { ok: false as const, failure: { kind: "not_configured" as const } };

  return result.ok
    ? { ok: true, content: result.content, provider: config.provider, model: config.model }
    : result;
}

/** Short, non-secret label for the failure, safe to show to a signed-in user. */
export function describeLlmFailure(failure: LlmFailure): string {
  switch (failure.kind) {
    case "not_configured":
      return "no AI model is configured";
    case "unauthorized":
      return "the AI service is not configured correctly";
    case "rate_limited":
      return "the AI service is busy right now";
    case "timeout":
      return "the AI service took too long to respond";
    case "bad_response":
      return "the AI service returned an unusable response";
    default:
      return "the AI service is unavailable";
  }
}
