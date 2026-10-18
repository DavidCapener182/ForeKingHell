import { buildClubBenchmarkRows, type ClubBenchmarkMetricKey } from "@/lib/club-benchmarks";
import {
  BENCHMARK_CALCULATION_VERSION,
  BENCHMARK_REFERENCE_VERSION,
} from "@/lib/benchmark-registry";
import { benchmarkMilestones, benchmarkSessionHistory } from "@/lib/benchmark-milestones";
import {
  performanceMetricValue,
  selectPerformancePotentialShots,
  type PerformanceIntelligence,
  type PerformanceShot,
} from "@/lib/performance-intelligence";
import { mean } from "@/lib/analysis-statistics";

export type BenchmarkObservation = PerformanceShot & {
  sessionCreatedAt?: Date | string;
  apexFt?: number | null;
  smashFactor?: number | null;
  descentAngleDeg?: number | null;
  launchAngleDeg?: number | null;
  spinRate?: number | null;
  attackAngleDeg?: number | null;
  sourceRawJson?: Record<string, string>;
};

/** Old stored apex values with no unit evidence are not silently treated as verified feet. */
export function benchmarkObservationMetric(
  shot: BenchmarkObservation,
  metric: ClubBenchmarkMetricKey,
): number | null {
  if (metric === "carryYd" || metric === "ballSpeedMph" || metric === "clubSpeedMph")
    return performanceMetricValue(shot, metric);
  let value: number | null | undefined;
  if (metric === "maxHeightYd") {
    const raw = shot.sourceRawJson ?? {};
    let explicit = Object.keys(raw).some(
      (key) =>
        /apex|height/i.test(key) && /feet|\bft\b|yards|\byd\b|meters|metres|\bm\b/i.test(key),
    );
    try {
      const provenance: unknown = raw.__lmwtMetricProvenance
        ? JSON.parse(raw.__lmwtMetricProvenance)
        : null;
      if (provenance && typeof provenance === "object" && "apexYd" in provenance) {
        const reading = (provenance as Record<string, { comparable?: boolean }>).apexYd;
        explicit = reading?.comparable === true;
      }
    } catch {
      /* Corrupt metadata stays unresolved; raw records remain unchanged. */
    }
    value = explicit && shot.apexFt !== null && shot.apexFt !== undefined ? shot.apexFt / 3 : null;
  } else if (metric === "landAngleDeg") value = shot.descentAngleDeg;
  else value = shot[metric as "smashFactor" | "launchAngleDeg" | "spinRate" | "attackAngleDeg"];
  return typeof value === "number" &&
    Number.isFinite(value) &&
    (metric === "attackAngleDeg" || value > 0)
    ? value
    : null;
}

export function buildEvidenceBenchmarkRows(
  clubs: Array<{
    id: string;
    type: string;
    brandModel: string;
    rawShotCount: number;
    stock: { confidenceScore: number };
  }>,
  intelligence: PerformanceIntelligence,
  observations: BenchmarkObservation[],
) {
  return buildClubBenchmarkRows(
    clubs.map((club) => {
      // A table row shows one explicitly disclosed comparable context, never a pooled pseudo swing.
      const group = intelligence.groups.find(
        (g) => g.clubId === club.id && g.context.intent === "full" && g.potential.selectedCount > 0,
      );
      const ids = new Set(group?.potential.shotIds ?? []);
      const selected = observations.filter((s) => ids.has(s.id));
      const metricKeys: ClubBenchmarkMetricKey[] = [
        "carryYd",
        "clubSpeedMph",
        "ballSpeedMph",
        "smashFactor",
        "maxHeightYd",
        "landAngleDeg",
        "launchAngleDeg",
        "spinRate",
        "attackAngleDeg",
      ];
      const metrics = Object.fromEntries(
        metricKeys.map((key) => [
          key,
          mean(
            selected
              .map((s) => benchmarkObservationMetric(s, key))
              .filter((v): v is number => v !== null),
          ),
        ]),
      );
      const metricEvidence = Object.fromEntries(
        metricKeys.map((key) => {
          const valid = selected.filter((s) => benchmarkObservationMetric(s, key) !== null);
          return [
            key,
            {
              validCount: valid.length,
              selectedCount: selected.length,
              shotIds: valid.map((s) => s.id),
              method: `${BENCHMARK_CALCULATION_VERSION}; ${BENCHMARK_REFERENCE_VERSION}; mean of available readings from the same carry-selected IDs; imported smash retained; ${group ? JSON.stringify(group.context) : "No eligible context"}`,
            },
          ];
        }),
      );
      const contextRows = group
        ? observations.filter(
            (s) =>
              s.clubId === club.id &&
              s.source === group.context.source &&
              (s.equipmentId ?? null) === group.context.equipmentId &&
              (s.settingsKey ?? null) === group.context.settingsKey &&
              (s.ballType ?? null) === group.context.ballType &&
              (s.environment ?? null) === group.context.environment &&
              (s.normalization ?? null) === group.context.normalization &&
              (s.intentKey || s.shotCategory || "unknown") === group.context.intent,
          )
        : [];
      // Preserve milestone displays as computed historical attainment; saved award records are untouched.
      const history = benchmarkSessionHistory(
        contextRows.flatMap((s) =>
          s.sessionId
            ? [{ ...s, sessionId: s.sessionId, sessionCreatedAt: s.sessionCreatedAt ?? s.shotAt }]
            : [],
        ),
      ).flatMap(({ sessionId, date, sequence, shots }) => {
        const sample = selectPerformancePotentialShots(shots);
        const carryYd = mean(
          sample
            .map((s) => s.carryYd)
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
        );
        return carryYd === null
          ? []
          : [{ sessionId, date, sequence, carryYd, sampleSize: sample.length }];
      });
      return {
        clubId: club.id,
        clubType: club.type,
        brandModel: club.brandModel,
        carryYd: metrics.carryYd ?? null,
        metrics,
        metricEvidence,
        selectedShotIds: selected.map((s) => s.id),
        eligibleCount: group?.potential.eligibleCount ?? 0,
        sampleSize: selected.length,
        sampleCarryYards: selected.flatMap((s) => (s.carryYd === null ? [] : [s.carryYd])),
        reviewedShotCount: observations.filter((s) => s.clubId === club.id).length,
        savedShotCount: club.rawShotCount,
        bestSampleFloorYd: selected.length ? Math.min(...selected.map((s) => s.carryYd!)) : null,
        confidenceScore: club.stock.confidenceScore,
        milestones: benchmarkMilestones(club.type, history),
      };
    }),
  );
}
