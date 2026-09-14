import { afterAll, describe, expect, it, vi } from "vitest";
import { loadEnvConfig } from "@next/env";
import { writeFileSync } from "node:fs";

// Explicit opt-in: paid synthetic provider calls, with all application persistence mocked.
const live = process.env.ASTRA_LIVE_EVAL === "1";
const events = vi.hoisted(() => ({ final: vi.fn() }));
vi.mock("@/lib/ai/cache", () => ({
  hashAiRequest: () => "synthetic-eval",
  readAiGenerationCache: async () => null,
  writeAiGenerationCache: async () => undefined,
}));
vi.mock("@/lib/ai/usage", async (original) => ({
  ...(await original<typeof import("@/lib/ai/usage")>()),
  requireAiFeaturePlan: async () => ({ planKey: "full", monthlyLimit: 100, monthlyRemaining: 100 }),
  requireAiCredits: () => undefined,
  reserveAiCredits: async () => ({ eventId: "synthetic", creditsRemaining: 99 }),
  finalizeAiCreditReservation: events.final,
}));
import { generateAiJson } from "@/lib/ai/client";
import {
  aiCoachSummarySchema,
  coachChatAnswerSchema,
  dataChatAnswerSchema,
  practiceRecapSchema,
  courseStrategySchema,
} from "@/lib/ai/schemas";
import type { AiFeatureKey } from "@/lib/ai/features";

const rows: Record<string, unknown>[] = [];
afterAll(() => {
  vi.unstubAllEnvs();
  if (live) writeFileSync("/tmp/forekinghell-astra-eval.json", JSON.stringify(rows, null, 2));
});
const cases = [
  ["coach_summary", aiCoachSummarySchema],
  ["coach_chat", coachChatAnswerSchema],
  ["data_chat", dataChatAnswerSchema],
  ["practice_recap", practiceRecapSchema],
  ["course_strategy", courseStrategySchema],
] as const;
describe.skipIf(!live)("Astra synthetic provider evaluation", () => {
  if (live) loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  for (const model of ["gpt-4.1-mini", "gpt-6-astra"]) {
    it.each(cases)(
      `${model} %s`,
      async (featureKey, schema) => {
        vi.stubEnv("OPENAI_COACH_MODEL", model);
        events.final.mockClear();
        const result = await generateAiJson({
          userId: "synthetic-evaluation",
          featureKey: featureKey as AiFeatureKey,
          schemaName: featureKey,
          schema,
          useCache: false,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `You are a concise golf coach. Return the requested structured output using only these synthetic facts. Do not invent distances, rounds, handicaps or hazards. Give practical next steps; use low confidence for sparse data.\nTask: ${featureKey}.\nData: One practice session: 12 shots with 7-iron, median carry 140 yards, 8 shots finishing right of target. No round scores or handicap recorded. Bag: 7-iron carry 140 yards; pitching wedge carry 100 yards. For course strategy only: a 140-yard par 3, no known hazards or weather; recommend one supplied club and acknowledge missing context. For other tasks: explain the right miss and suggest one drill, without claiming a diagnosed swing fault. Keep each field brief.`,
                },
              ],
            },
          ],
        });
        expect(Object.keys(result.output).sort()).toEqual([...schema.required].sort());
        expect(result.model).toBe(model);
        const text = JSON.stringify(result.output);
        expect(text).toMatch(/140|right|7.iron/i);
        const usage = events.final.mock.calls.at(-1)?.[0];
        rows.push({
          model,
          featureKey,
          output: result.output,
          tokenStats: usage?.tokenStats,
          metadata: usage?.metadataJson,
        });
      },
      60_000,
    );
  }
});
