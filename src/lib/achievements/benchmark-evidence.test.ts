import { describe, expect, it } from "vitest";
import {
  achievementRewardKey,
  benchmarkAwardEvidence,
  isAchievementRewardCandidateEligible,
} from "./benchmark-evidence";

describe("benchmark award evidence and reward identity", () => {
  it("retains the legacy calculation separately from the active best-30 UI", () => {
    expect(benchmarkAwardEvidence()).toMatchObject({
      referenceVersion: "lmwt-legacy-v1",
      calculationVersion: "legacy-stock-median-v1",
    });
    expect(benchmarkAwardEvidence().method).toContain("separate from selected best-30");
  });
  it("allows the frozen legacy rule and blocks reference upgrades from minting benchmark XP", () => {
    const candidate = {
      achievementId: "club_driver_benchmark_good",
      metadata: benchmarkAwardEvidence(),
    };
    expect(isAchievementRewardCandidateEligible(candidate)).toBe(true);
    expect(
      isAchievementRewardCandidateEligible({
        ...candidate,
        metadata: { ...candidate.metadata, referenceVersion: "lmwt-v2" },
      }),
    ).toBe(false);
    expect(isAchievementRewardCandidateEligible({ achievementId: "benchmark_first_good" })).toBe(
      false,
    );
    expect(isAchievementRewardCandidateEligible({ achievementId: "first_import" })).toBe(true);
  });
  it("keeps reward identity stable across recalculation, filters and reference metadata", () => {
    const id = "benchmark_first_good";
    const candidates = [
      { referenceVersion: "lmwt-legacy-v1" },
      { referenceVersion: "lmwt-v2" },
      { filters: "new-filter" },
    ].map((metadata) => ({ achievementId: id, metadata }));
    expect(
      new Set(candidates.map((candidate) => achievementRewardKey(candidate.achievementId))).size,
    ).toBe(1);
    expect(achievementRewardKey(id)).toBe("achievement:benchmark_first_good");
  });
});
