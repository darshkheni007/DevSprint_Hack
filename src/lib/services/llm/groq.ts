/**
 * Groq provider adapter.
 *
 * All Groq-specific details live here (OpenAI-compatible endpoint, request
 * shape, reasoning-model handling) so the provider can be replaced without
 * touching the assistant UI or the retrieval logic.
 *
 * This module never logs or returns the API key, request headers, or raw
 * provider response bodies — only a coarse `LlmFailure` reason.
 */
import type { UnsafeLlmConfig } from "./config";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type LlmFailure =
  /** No key/provider configured; the caller should use the offline fallback. */
  | { kind: "not_configured" }
  /** 401/403 — the key is missing, wrong, or lacks access to the model. */
  | { kind: "unauthorized" }
  /** 429 — provider rate limit or quota. */
  | { kind: "rate_limited" }
  /** Aborted after `timeoutMs`. */
  | { kind: "timeout" }
  /** 5xx, network error, or any other unexpected status. */
  | { kind: "unavailable" }
  /** 200 but no usable text (e.g. only reasoning tokens were produced). */
  | { kind: "bad_response" };

export type LlmCallResult =
  | { ok: true; content: string }
  | { ok: false; failure: LlmFailure };

/** Cap the answer so a runaway response cannot blow up the UI or the logs. */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * Models that spend tokens on hidden reasoning need `reasoning_effort: low`,
 * otherwise the visible answer can be starved (empty `content`).
 */
function isReasoningModel(model: string): boolean {
  return /gpt-oss/i.test(model);
}

function failureForStatus(status: number): LlmFailure {
  if (status === 401 || status === 403) return { kind: "unauthorized" };
  if (status === 429) return { kind: "rate_limited" };
  return { kind: "unavailable" };
}

/** Call Groq's OpenAI-compatible Chat Completions endpoint. */
export async function callGroq(
  config: UnsafeLlmConfig,
  messages: LlmMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<LlmCallResult> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.2,
    max_tokens: MAX_OUTPUT_TOKENS,
  };
  if (isReasoningModel(config.model)) {
    body.reasoning_effort = "low";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Deliberately do not read/return the response body: it may echo
      // configuration details and is not needed to decide the fallback.
      return { ok: false, failure: failureForStatus(response.status) };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, failure: { kind: "bad_response" } };
    }
    return { ok: true, content: content.trim() };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, failure: { kind: aborted ? "timeout" : "unavailable" } };
  } finally {
    clearTimeout(timer);
  }
}
