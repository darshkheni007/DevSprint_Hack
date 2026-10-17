/**
 * Server-only configuration for the AI assistant's LLM provider.
 *
 * The API key is read from `LLM_API_KEY` and is NEVER returned to the client,
 * logged, or included in error messages. The provider defaults to Groq
 * (owner-approved: see `requirements/02-security-requirements.md` SEC-AI07)
 * and can be changed with `LLM_PROVIDER` without touching the assistant UI.
 *
 * Only `LLM_API_KEY` is required; the remaining variables are optional
 * overrides. See `.env.example`.
 */

/** Providers this build knows how to call. Add a new adapter + entry here. */
export const LLM_PROVIDERS = ["groq"] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export interface UnsafeLlmConfig {
  provider: LlmProvider;
  /** Secret. Must never leave the server or be attached to errors. */
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

export type LlmConfigResult =
  | { ok: true; config: UnsafeLlmConfig }
  | { ok: false; reason: string };

/** Per-provider defaults, overridable by env. */
const DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string }> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    // Verified against this key's /models list; reasoning tokens are handled by
    // the Groq adapter so the final answer is not starved.
    model: "openai/gpt-oss-120b",
  },
};

const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;

function readTimeoutMs(raw: string | undefined): number {
  const value = Number((raw ?? "").trim());
  if (!Number.isFinite(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.round(value);
}

function isProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Resolve the LLM configuration from the environment.
 *
 * On failure the `reason` is a fixed, safe sentence — it never echoes the API
 * key or any other secret value back to the caller.
 */
export function readLlmConfig(
  env: NodeJS.ProcessEnv = process.env,
): LlmConfigResult {
  const apiKey = (env.LLM_API_KEY ?? "").trim();
  if (!apiKey) {
    return { ok: false, reason: "LLM_API_KEY is not configured." };
  }

  const requested = (env.LLM_PROVIDER ?? "groq").trim().toLowerCase();
  if (!isProvider(requested)) {
    return {
      ok: false,
      reason: "LLM_PROVIDER is not a supported provider.",
    };
  }

  const defaults = DEFAULTS[requested];
  const model = (env.LLM_MODEL ?? "").trim() || defaults.model;
  const baseUrl =
    (env.LLM_BASE_URL ?? "").trim().replace(/\/+$/, "") || defaults.baseUrl;

  return {
    ok: true,
    config: {
      provider: requested,
      apiKey,
      model,
      baseUrl,
      timeoutMs: readTimeoutMs(env.LLM_TIMEOUT_MS),
    },
  };
}

/**
 * Safe, non-secret description of the assistant's LLM status. Safe to render in
 * the UI or write to logs (it contains no key material).
 */
export function describeLlm(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  provider?: LlmProvider;
  model?: string;
  reason?: string;
} {
  const result = readLlmConfig(env);
  return result.ok
    ? {
        configured: true,
        provider: result.config.provider,
        model: result.config.model,
      }
    : { configured: false, reason: result.reason };
}
