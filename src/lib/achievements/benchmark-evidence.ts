import { BENCHMARK_REFERENCE_VERSION } from "@/lib/benchmark-registry";
import type { AchievementStockYardage, AchievementUnlockCandidate } from "./types";

/** Deliberately pinned independently of the active reference. Updating references
 * requires an explicit reward-policy review; relabelling is not an earned result. */
export const BENCHMARK_REWARD_REFERENCE_VERSION = "lmwt-legacy-v1";
export const BENCHMARK_AWARD_CALCULATION_VERSION = "legacy-stock-median-v1";

export function benchmarkAwardEvidence(stock?: AchievementStockYardage) {
  return {
    referenceVersion: BENCHMARK_REFERENCE_VERSION,
    calculationVersion: BENCHMARK_AWARD_CALCULATION_VERSION,
    method: "Legacy stock median carry; separate from selected best-30 potential",
    ...(stock
      ? {
          evidenceId: `${stock.clubId}:${stock.calculatedAt.toISOString()}`,
          evidenceRecordedAt: stock.calculatedAt.toISOString(),
          equipmentId: stock.clubId,
        }
      : {}),
  };
}

export function isBenchmarkAchievementId(id: string) {
  return id.startsWith("benchmark_") || /^club_.+_benchmark_/.test(id);
}

export function isAchievementRewardCandidateEligible(candidate: AchievementUnlockCandidate) {
  return (
    !isBenchmarkAchievementId(candidate.achievementId) ||
    candidate.metadata?.referenceVersion === BENCHMARK_REWARD_REFERENCE_VERSION
  );
}

/** Metadata, imports, reference versions and filters never alter this identity. */
export function achievementRewardKey(achievementId: string) {
  return `achievement:${achievementId}`;
}
