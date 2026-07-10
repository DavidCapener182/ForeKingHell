import { describe, expect, it, vi } from "vitest";

import { calculateRepeatabilityScore } from "@/lib/repeatability-score";

describe("calculateRepeatabilityScore", () => {
  it("separates distance and direction and exposes the underlying components", () => {
    vi.setSystemTime(new Date("2026-07-10T10:00:00Z"));
    const result = calculateRepeatabilityScore(
      Array.from({ length: 20 }, (_, index) => ({
        carryYd: 150 + (index % 5) - 2,
        sideYd: (index % 5) - 2,
        sessionId: index < 10 ? "one" : "two",
        shotAt: new Date("2026-07-08T10:00:00Z"),
      })),
    );
    expect(result.score).toBeGreaterThan(80);
    expect(result.distanceScore).toBeGreaterThan(90);
    expect(result.directionalScore).toBeGreaterThan(90);
    expect(result.confidence.label).not.toBe("early");
    vi.useRealTimers();
  });

  it("penalises a two-way miss", () => {
    const result = calculateRepeatabilityScore(
      [-25, -20, -12, 12, 20, 25, -18, 18].map((sideYd) => ({ carryYd: 160, sideYd })),
    );
    expect(result.twoWayMiss).toBe(true);
    expect(result.twoWayPenalty).toBe(12);
  });

  it("does not present a tight but badly biased group as a good outcome", () => {
    const result = calculateRepeatabilityScore(
      Array.from({ length: 20 }, (_, index) => ({
        carryYd: 160 + (index % 2),
        sideYd: 30 + (index % 2),
      })),
    );
    expect(result.biasPenalty).toBeGreaterThan(0);
    expect(result.explanation).toContain("materially biased");
  });
});
