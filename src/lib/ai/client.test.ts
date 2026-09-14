import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
  finalize: vi.fn(),
  reserve: vi.fn(),
  access: vi.fn(),
  credits: vi.fn(),
  log: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/ai/cache", () => ({
  hashAiRequest: (input: unknown) => JSON.stringify(input),
  readAiGenerationCache: mocks.readCache,
  writeAiGenerationCache: mocks.writeCache,
}));
vi.mock("@/lib/ai/usage", async (original) => ({
  ...(await original<typeof import("@/lib/ai/usage")>()),
  requireAiFeaturePlan: mocks.access,
  requireAiCredits: mocks.credits,
  reserveAiCredits: mocks.reserve,
  finalizeAiCreditReservation: mocks.finalize,
  logAiUsageEvent: mocks.log,
}));
import { generateAiJson } from "@/lib/ai/client";

const request = {
  userId: "test-user",
  featureKey: "coach_summary" as const,
  schemaName: "answer",
  schema: {
    type: "object" as const,
    additionalProperties: false as const,
    properties: { answer: { type: "string" } },
    required: ["answer"],
  },
  messages: [
    {
      role: "user" as const,
      content: [{ type: "input_text" as const, text: "Use the supplied golf records." }],
    },
  ],
  cachePayload: { score: 83 },
};
const completed = {
  id: "resp_test",
  status: "completed",
  output: [
    { type: "reasoning", content: [{ text: "Ignore this content" }] },
    { type: "message", content: [{ type: "output_text", text: '{"answer":"Practice putting."}' }] },
  ],
  usage: { input_tokens: 50, output_tokens: 100, output_tokens_details: { reasoning_tokens: 80 } },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_COACH_MODEL", "gpt-6-astra");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.access.mockResolvedValue({ planKey: "pro", monthlyLimit: 100, monthlyRemaining: 100 });
  mocks.reserve.mockResolvedValue({ eventId: "reservation", creditsRemaining: 99 });
  mocks.writeCache.mockResolvedValue(undefined);
  mocks.fetch.mockImplementation(async () => Response.json(completed));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI Responses client", () => {
  it("sends Astra reasoning headroom and only reads message output text", async () => {
    const result = await generateAiJson(request);
    expect(result.output).toEqual({ answer: "Practice putting." });
    const options = mocks.fetch.mock.calls[0][1];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      model: "gpt-6-astra",
      reasoning: { effort: "low" },
      max_output_tokens: 4996,
    });
    expect(body).not.toHaveProperty("temperature");
    expect(mocks.finalize).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        status: "success",
        tokenStats: { inputTokens: 50, outputTokens: 100 },
        metadataJson: expect.objectContaining({ reasoningTokens: 80 }),
      }),
    );
  });
  it("retains the legacy request contract when rolled back", async () => {
    vi.stubEnv("OPENAI_COACH_MODEL", "gpt-4.1-mini");
    await generateAiJson(request);
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.max_output_tokens).toBe(900);
    expect(body).not.toHaveProperty("reasoning");
  });
  it.each([
    [
      "incomplete",
      { ...completed, status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
    ],
    ["failed", { ...completed, status: "failed" }],
    ["provider error", { ...completed, error: { code: "server_error" } }],
    [
      "refusal",
      {
        ...completed,
        output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }],
      },
    ],
    [
      "invalid JSON",
      {
        ...completed,
        output: [{ type: "message", content: [{ type: "output_text", text: "bad json" }] }],
      },
    ],
    ["missing output", { ...completed, output: [] }],
  ])("releases credits and avoids caching on %s", async (_, payload) => {
    mocks.fetch.mockResolvedValue(Response.json(payload));
    await expect(generateAiJson(request)).rejects.toThrow();
    expect(mocks.writeCache).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: "error", releaseCredits: true }),
    );
  });
  it.each([429, 500])("releases credits for HTTP %s", async (status) => {
    mocks.fetch.mockResolvedValue(Response.json({ error: {} }, { status }));
    await expect(generateAiJson(request)).rejects.toMatchObject({ code: "ai_upstream_error" });
    expect(mocks.finalize).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ releaseCredits: true }),
    );
  });
  it.each(["network", "body"])("releases credits when the %s times out", async (phase) => {
    const error = new DOMException("Timed out", "TimeoutError");
    if (phase === "network") mocks.fetch.mockRejectedValue(error);
    else
      mocks.fetch.mockResolvedValue({
        json: async () => {
          throw error;
        },
      });
    await expect(generateAiJson(request)).rejects.toThrow();
    expect(mocks.finalize).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ releaseCredits: true }),
    );
  });
  it("never contacts the provider or reserves credits on a cache hit", async () => {
    mocks.readCache.mockResolvedValue({ answer: "Cached" });
    expect(await generateAiJson(request)).toMatchObject({ cached: true, creditsCharged: 0 });
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("invalidates cached results after prompt, schema, model or output-budget changes", async () => {
    await generateAiJson(request);
    await generateAiJson({
      ...request,
      messages: [{ role: "user", content: [{ type: "input_text", text: "Changed prompt" }] }],
    });
    await generateAiJson({ ...request, schemaName: "new_schema" });
    await generateAiJson({
      ...request,
      schema: { ...request.schema, properties: { answer: { type: "string", maxLength: 100 } } },
    });
    await generateAiJson({ ...request, maxOutputTokens: 1000 });
    vi.stubEnv("OPENAI_COACH_MODEL", "gpt-4.1-mini");
    await generateAiJson(request);
    const hashes = mocks.readCache.mock.calls.map(([input]) => input.requestHash);
    expect(new Set(hashes).size).toBe(6);
  });
  it("does not reserve or call upstream if access is denied", async () => {
    mocks.access.mockRejectedValue(new Error("Access denied"));
    await expect(generateAiJson(request)).rejects.toThrow();
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
