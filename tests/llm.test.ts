import { afterEach, describe, expect, it, vi } from "vitest";
import { callGroq } from "@/lib/services/llm/groq";
import {
  describeLlm,
  readLlmConfig,
  type UnsafeLlmConfig,
} from "@/lib/services/llm/config";
import { describeLlmFailure, generateAnswer } from "@/lib/services/llm";
import { assistantSchema } from "@/lib/validation";

/**
 * LLM layer tests. The provider is always MOCKED — no network calls are made
 * and no real API key is used. The fake key below exists only to prove that
 * key material never leaks into returned values, reasons, or bodies.
 */
const FAKE_KEY = "fake-key-for-tests-only";
const asFetch = (fn: unknown) => fn as unknown as typeof fetch;

const config: UnsafeLlmConfig = {
  provider: "groq",
  apiKey: FAKE_KEY,
  model: "openai/gpt-oss-120b",
  baseUrl: "https://api.groq.com/openai/v1",
  timeoutMs: 5_000,
};

const messages = [
  { role: "system" as const, content: "system rules" },
  { role: "user" as const, content: "hello" },
];

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Configuration validation (never exposes secrets)
// ---------------------------------------------------------------------------

describe("LLM configuration", () => {
  it("reports not-configured when LLM_API_KEY is missing", () => {
    const result = readLlmConfig({} as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("LLM_API_KEY is not configured.");
  });

  it("treats a blank key as not-configured", () => {
    expect(readLlmConfig({ LLM_API_KEY: "   " } as unknown as NodeJS.ProcessEnv).ok).toBe(false);
  });

  it("defaults to the approved Groq provider, its endpoint and a supported model", () => {
    const result = readLlmConfig({ LLM_API_KEY: FAKE_KEY } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.provider).toBe("groq");
    expect(result.config.baseUrl).toBe("https://api.groq.com/openai/v1");
    expect(result.config.model).toBe("openai/gpt-oss-120b");
    expect(result.config.timeoutMs).toBe(15_000);
  });

  it("accepts overrides (case-insensitive provider, custom model/base URL/timeout)", () => {
    const result = readLlmConfig({
      LLM_API_KEY: FAKE_KEY,
      LLM_PROVIDER: "Groq",
      LLM_MODEL: "custom-model",
      LLM_BASE_URL: "https://example.test/v1/",
      LLM_TIMEOUT_MS: "8000",
    } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.model).toBe("custom-model");
    expect(result.config.baseUrl).toBe("https://example.test/v1");
    expect(result.config.timeoutMs).toBe(8_000);
  });

  it("clamps an out-of-range timeout back to the default", () => {
    for (const bad of ["10", "999999999", "not-a-number"]) {
      const result = readLlmConfig({
        LLM_API_KEY: FAKE_KEY,
        LLM_TIMEOUT_MS: bad,
      } as unknown as NodeJS.ProcessEnv);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.config.timeoutMs).toBe(15_000);
    }
  });

  it("rejects an unsupported provider without echoing the raw value or the key", () => {
    const result = readLlmConfig({
      LLM_API_KEY: FAKE_KEY,
      LLM_PROVIDER: "definitely-not-a-provider",
    } as unknown as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).not.toContain("definitely-not-a-provider");
      expect(result.reason).not.toContain(FAKE_KEY);
    }
  });

  it("never exposes the API key through describeLlm()", () => {
    const described = describeLlm({ LLM_API_KEY: FAKE_KEY } as unknown as NodeJS.ProcessEnv);
    expect(described.configured).toBe(true);
    expect(described.provider).toBe("groq");
    expect(JSON.stringify(described)).not.toContain(FAKE_KEY);

    const missing = describeLlm({} as unknown as NodeJS.ProcessEnv);
    expect(missing.configured).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Provider adapter (mocked HTTP)
// ---------------------------------------------------------------------------

describe("Groq adapter", () => {
  it("returns the model text and sends the key only as an Authorization header", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { choices: [{ message: { content: "  Hello there  " } }] }));

    const result = await callGroq(config, messages, asFetch(fetchMock));

    expect(result).toEqual({ ok: true, content: "Hello there" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_KEY}`);

    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.messages).toEqual(messages);
    // gpt-oss burns tokens on hidden reasoning; we must ask for low effort.
    expect(body.reasoning_effort).toBe("low");
    expect(String(init.body)).not.toContain(FAKE_KEY);
  });

  it("does not send reasoning_effort for a non-reasoning model", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { choices: [{ message: { content: "ok" } }] }));
    await callGroq({ ...config, model: "qwen3-27b" }, messages, asFetch(fetchMock));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect("reasoning_effort" in JSON.parse(String(init.body))).toBe(false);
  });

  it("maps status codes to coarse failures without leaking the provider body", async () => {
    const cases: Array<[number, string]> = [
      [401, "unauthorized"],
      [403, "unauthorized"],
      [429, "rate_limited"],
      [500, "unavailable"],
      [503, "unavailable"],
    ];
    for (const [status, kind] of cases) {
      const fetchMock = vi.fn(async () => jsonResponse(status, { error: "leaky provider detail" }));
      const result = await callGroq(config, messages, asFetch(fetchMock));
      expect(result).toEqual({ ok: false, failure: { kind } });
      expect(JSON.stringify(result)).not.toContain("leaky provider detail");
      expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
    }
  });

  it("treats an empty content response (reasoning-only output) as bad_response", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { choices: [{ message: { content: "   ", reasoning: "thinking…" } }] }),
    );
    expect(await callGroq(config, messages, asFetch(fetchMock))).toEqual({
      ok: false,
      failure: { kind: "bad_response" },
    });
  });

  it("treats malformed JSON as unavailable", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token");
      },
    }) as unknown as Response);
    expect(await callGroq(config, messages, asFetch(fetchMock))).toEqual({
      ok: false,
      failure: { kind: "unavailable" },
    });
  });

  it("treats a network error as unavailable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await callGroq(config, messages, asFetch(fetchMock))).toEqual({
      ok: false,
      failure: { kind: "unavailable" },
    });
  });

  it("aborts slow providers and reports a timeout", async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    const result = await callGroq({ ...config, timeoutMs: 20 }, messages, asFetch(fetchMock));
    expect(result).toEqual({ ok: false, failure: { kind: "timeout" } });
  });
});

// ---------------------------------------------------------------------------
// Provider-agnostic entry point
// ---------------------------------------------------------------------------

describe("generateAnswer", () => {
  it("returns not_configured and never calls the provider when no key is set", async () => {
    vi.stubEnv("LLM_API_KEY", "");
    const fetchMock = vi.fn();
    const result = await generateAnswer(messages, asFetch(fetchMock));
    expect(result).toEqual({ ok: false, failure: { kind: "not_configured" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the generated content and the model that produced it", async () => {
    vi.stubEnv("LLM_API_KEY", FAKE_KEY);
    const fetchMock = vi.fn(async () => jsonResponse(200, { choices: [{ message: { content: "Answer" } }] }));
    const result = await generateAnswer(messages, asFetch(fetchMock));
    expect(result).toEqual({ ok: true, content: "Answer", provider: "groq", model: "openai/gpt-oss-120b" });
  });

  it("describes every failure in safe, user-readable language", () => {
    expect(describeLlmFailure({ kind: "rate_limited" })).toMatch(/busy/i);
    for (const kind of ["not_configured", "unauthorized", "timeout", "unavailable", "bad_response"] as const) {
      const reason = describeLlmFailure({ kind });
      expect(reason.length).toBeGreaterThan(0);
      expect(reason).not.toMatch(/key|token|bearer|sk-|fake-key/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Input validation (empty / excessively long)
// ---------------------------------------------------------------------------

describe("assistant question validation", () => {
  it("rejects empty and whitespace-only questions", () => {
    expect(assistantSchema.safeParse({ question: "" }).success).toBe(false);
    expect(assistantSchema.safeParse({ question: "    " }).success).toBe(false);
    expect(assistantSchema.safeParse({ question: undefined }).success).toBe(false);
  });

  it("rejects an excessively long question with a too_big issue", () => {
    const parsed = assistantSchema.safeParse({ question: "x".repeat(501) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.code === "too_big")).toBe(true);
    }
  });

  it("accepts a question at the limit", () => {
    expect(assistantSchema.safeParse({ question: "x".repeat(500) }).success).toBe(true);
  });
});
