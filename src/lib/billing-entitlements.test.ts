import { describe, expect, it } from "vitest";

import { planAllowsAiCoach, planAllowsPrivateChallenges } from "@/lib/billing";

describe("billing entitlement gates", () => {
  it("keeps private challenges out of the free plan", () => {
    expect(planAllowsPrivateChallenges("free")).toBe(false);
    expect(planAllowsPrivateChallenges("plus")).toBe(true);
    expect(planAllowsPrivateChallenges("pro")).toBe(true);
    expect(planAllowsPrivateChallenges("coach")).toBe(true);
    expect(planAllowsPrivateChallenges("full")).toBe(true);
  });

  it("limits AI coach to Pro, Coach / Club, and Lifetime Full", () => {
    expect(planAllowsAiCoach("free")).toBe(false);
    expect(planAllowsAiCoach("plus")).toBe(false);
    expect(planAllowsAiCoach("pro")).toBe(true);
    expect(planAllowsAiCoach("coach")).toBe(true);
    expect(planAllowsAiCoach("full")).toBe(true);
  });
});
