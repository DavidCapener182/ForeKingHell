import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aiFeatureAccessLabel,
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

  it("explains paid access using the feature minimum plan", () => {
    expect(aiFeatureAccessLabel("coach_chat")).toContain("Pro");
    expect(aiFeatureAccessLabel("data_chat")).toContain("Pro");
    expect(aiFeatureAccessLabel("coach_player_summary")).toContain("Coach / Club");
  });
});
