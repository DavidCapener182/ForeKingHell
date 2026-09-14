import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aiFeatureAccessLabel,
  aiRequestSettings,
  monthlyAiCreditDefaults,
  planAllowsAiFeature,
  resolveAiModel,
} from "@/lib/ai/features";

describe("AI feature policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps free users locked out of live AI features", () => {
    expect(planAllowsAiFeature("free", "weekly_recap")).toBe(false);
    expect(planAllowsAiFeature("free", "coach_summary")).toBe(false);
    expect(monthlyAiCreditDefaults.free).toBe(0);
  });

  it("allows Plus only on light AI features", () => {
    expect(planAllowsAiFeature("plus", "weekly_recap")).toBe(true);
    expect(planAllowsAiFeature("plus", "social_caption")).toBe(true);
    expect(planAllowsAiFeature("plus", "session_roast")).toBe(true);
    expect(planAllowsAiFeature("plus", "scorecard_extract")).toBe(true);
    expect(planAllowsAiFeature("plus", "coach_chat")).toBe(false);
    expect(planAllowsAiFeature("plus", "data_chat")).toBe(false);
    expect(planAllowsAiFeature("plus", "course_strategy")).toBe(false);
  });

  it("allows Pro on core AI coach features and reserves bulk summaries for Coach", () => {
    expect(planAllowsAiFeature("pro", "coach_summary")).toBe(true);
    expect(planAllowsAiFeature("pro", "coach_chat")).toBe(true);
    expect(planAllowsAiFeature("pro", "data_chat")).toBe(true);
    expect(planAllowsAiFeature("pro", "course_strategy")).toBe(true);
    expect(planAllowsAiFeature("pro", "coach_player_summary")).toBe(false);
    expect(planAllowsAiFeature("coach", "coach_player_summary")).toBe(true);
    expect(planAllowsAiFeature("full", "coach_player_summary")).toBe(true);
  });

  it("resolves feature-specific models before shared fallbacks", () => {
    vi.stubEnv("OPENAI_FAST_MODEL", "fast-model");
    vi.stubEnv("OPENAI_COACH_MODEL", "coach-model");

    expect(resolveAiModel("social_caption")).toBe("fast-model");
    expect(resolveAiModel("session_roast")).toBe("fast-model");
    expect(resolveAiModel("coach_summary")).toBe("coach-model");

    vi.stubEnv("OPENAI_WEEKLY_RECAP_MODEL", "weekly-model");
    expect(resolveAiModel("weekly_recap")).toBe("weekly-model");
  });

  it("migrates only the first feature group when no overrides exist", () => {
    for (const key of [
      "OPENAI_COACH_MODEL",
      "OPENAI_FAST_MODEL",
      "OPENAI_SCORECARD_MODEL",
      "OPENAI_WEEKLY_RECAP_MODEL",
      "OPENAI_PREMIUM_MODEL",
    ])
      vi.stubEnv(key, "");
    expect(resolveAiModel("coach_chat")).toBe("gpt-6-astra");
    expect(resolveAiModel("course_strategy")).toBe("gpt-6-astra");
    expect(resolveAiModel("scorecard_extract")).toBe("gpt-4.1-mini");
    expect(resolveAiModel("social_caption")).toBe("gpt-4.1-mini");
    expect(resolveAiModel("weekly_recap")).toBe("gpt-4.1-mini");
    expect(resolveAiModel("coach_player_summary")).toBe("gpt-4.1-mini");
    vi.stubEnv("OPENAI_COACH_MODEL", "gpt-4.1-mini");
    expect(resolveAiModel("coach_chat")).toBe("gpt-4.1-mini");
  });

  it("adds reasoning headroom only for Astra", () => {
    expect(aiRequestSettings("gpt-6-astra", 700)).toEqual({
      reasoning: { effort: "low" },
      max_output_tokens: 4796,
    });
    expect(aiRequestSettings("gpt-4.1-mini", 700)).toEqual({ max_output_tokens: 700 });
  });

  it("explains paid access using the feature minimum plan", () => {
    expect(aiFeatureAccessLabel("coach_chat")).toContain("Pro");
    expect(aiFeatureAccessLabel("data_chat")).toContain("Pro");
    expect(aiFeatureAccessLabel("coach_player_summary")).toContain("Coach / Club");
  });
});
