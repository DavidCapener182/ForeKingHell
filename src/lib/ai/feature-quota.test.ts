import { describe, expect, it } from "vitest";
import { aiFeatureQuota } from "@/lib/ai/feature-quota";
import type { PlanKey } from "@/lib/billing-plan-catalog";

describe("advertised AI request limits", () => {
  it.each<[PlanKey, number, number]>([
    ["free", 0, 0],
    ["plus", 0, 2],
    ["pro", 30, 10],
    ["coach", 60, 25],
    ["full", 100, 50],
  ])("enforces %s allowances", (plan, chats, extracts) => {
    expect(aiFeatureQuota(plan, "coach_chat")?.limit).toBe(chats);
    expect(aiFeatureQuota(plan, "data_chat")?.limit).toBe(chats);
    expect(aiFeatureQuota(plan, "scorecard_extract")?.limit).toBe(extracts);
  });
  it("shares one daily bucket across both chat tools", () => {
    const now = new Date("2026-09-14T23:59:59Z");
    const quota = aiFeatureQuota("pro", "coach_chat", now);
    expect(quota).toEqual(aiFeatureQuota("pro", "data_chat", now));
    expect(quota?.features).toEqual(["coach_chat", "data_chat"]);
    expect(quota?.end.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });
  it("resets monthly extraction limits across the year boundary", () => {
    const quota = aiFeatureQuota("plus", "scorecard_extract", new Date("2026-12-31T23:59:59Z"));
    expect(quota?.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(quota?.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("keeps recaps on the shared credit budget without a separate chat allowance", () => {
    expect(aiFeatureQuota("plus", "weekly_recap")).toBeNull();
  });
});
