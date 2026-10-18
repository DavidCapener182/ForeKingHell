import { normaliseSourceRawJson } from "@/lib/source-raw-json";
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
  sourceRawJson?: Record<string, string> | string;
};

type PeakHeightUnit = "feet" | "yards" | "meters";
const peakHeightWithUnit =
  /^(apex|max(?:imum)?[\s_-]*height|peak[\s_-]*height|height)(?:\s*\(\s*([a-z]+)\s*\)|\s*\[\s*([a-z]+)\s*\]|[\s_-]+([a-z]+))$/i;

/** Explicit peak-height headers only. Impact height and inferred units are never apex evidence. */
export function resolvePeakHeightHeaderUnit(
  raw: Record<string, string>,
  canonicalApexFt: number | null | undefined,
): PeakHeightUnit | null {
  if (
    typeof canonicalApexFt !== "number" ||
    !Number.isFinite(canonicalApexFt) ||
    canonicalApexFt <= 0
  )
    return null;
  const units = new Set<PeakHeightUnit>();
  let unresolvedPeak = false;
  for (const [header, value] of Object.entries(raw)) {
    if (!value.trim()) continue;
    const match = header.trim().match(peakHeightWithUnit);
    // Legacy exports may retain unitless aliases beside their explicit-unit field.
    // An alias supplies no unit evidence, but cannot override a verified explicit reading.
    if (!match) continue;
    const unit = (match[2] ?? match[3] ?? match[4] ?? "").toLowerCase();
    const resolvedUnit = ["ft", "feet", "foot"].includes(unit)
      ? "feet"
      : ["yd", "yds", "yard", "yards"].includes(unit)
        ? "yards"
        : ["m", "meter", "meters", "metre", "metres"].includes(unit)
          ? "meters"
          : null;
    if (!resolvedUnit) {
      unresolvedPeak = true;
      continue;
    }
    const rawNumber = Number(value.trim().replaceAll(",", ""));
    const feet =
      resolvedUnit === "feet"
        ? rawNumber
        : resolvedUnit === "yards"
          ? rawNumber * 3
          : rawNumber / 0.3048;
    if (!Number.isFinite(rawNumber) || rawNumber <= 0 || !heightValuesAgree(feet, canonicalApexFt))
      unresolvedPeak = true;
    units.add(resolvedUnit);
  }
  // Multiple explicit units are safe only because every converted value matched stored feet.
  return !unresolvedPeak && units.size > 0 ? [...units][0]! : null;
}

// Stored feet may be rounded to three decimal places. This tolerance is below 0.004 yards.
function heightValuesAgree(leftFt: number, rightFt: number) {
  return Math.abs(leftFt - rightFt) <= 0.01;
}

function apexHasComparableProvenance(
  raw: Record<string, string>,
  canonicalApexFt: number | null | undefined,
): boolean {
  if (
    typeof canonicalApexFt !== "number" ||
    !Number.isFinite(canonicalApexFt) ||
    canonicalApexFt <= 0
  )
    return false;
  if (!("__lmwtMetricProvenance" in raw))
    return resolvePeakHeightHeaderUnit(raw, canonicalApexFt) !== null;
  try {
    const metadata: unknown = JSON.parse(raw.__lmwtMetricProvenance!);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
    // Partial metric metadata is not a claim about apex; verify its explicit source reading instead.
    if (!Object.hasOwn(metadata, "apexYd"))
      return resolvePeakHeightHeaderUnit(raw, canonicalApexFt) !== null;
    const reading: unknown = (metadata as Record<string, unknown>).apexYd;
    if (!reading || typeof reading !== "object" || Array.isArray(reading)) return false;
    const value = reading as Record<string, unknown>;
    return (
      value.comparable === true &&
      value.unit === "yd" &&
      ["measured", "estimated", "derived", "reconstructed"].includes(String(value.status)) &&
      typeof value.value === "number" &&
      Number.isFinite(value.value) &&
      value.value > 0 &&
      heightValuesAgree(value.value * 3, canonicalApexFt)
    );
  } catch {
    // Malformed provenance must not be bypassed by a second, superficially valid header.
    return false;
  }
}

function observationMetricStatus(shot: BenchmarkObservation, metric: ClubBenchmarkMetricKey) {
  if (metric === "carryYd" || metric === "clubSpeedMph" || metric === "ballSpeedMph") {
    const status = shot.metricStatus?.[metric];
    if (status !== undefined) return status;
  }
  const raw = normaliseSourceRawJson(shot.sourceRawJson);
  if (!Object.hasOwn(raw, "__lmwtMetricProvenance")) return undefined;
  try {
    const metadata: unknown = raw.__lmwtMetricProvenance
      ? JSON.parse(raw.__lmwtMetricProvenance)
      : null;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "unknown";
    const key = metric === "maxHeightYd" ? "apexYd" : metric;
    if (!Object.hasOwn(metadata, key)) return undefined;
    const reading: unknown = (metadata as Record<string, unknown>)[key];
    const status =
      reading && typeof reading === "object" && "status" in reading ? reading.status : undefined;
    return [
      "measured",
      "estimated",
      "derived",
      "reconstructed",
      "unknown",
      "invalid",
      "unavailable",
    ].includes(String(status))
      ? status
      : "unknown";
  } catch {
    return "unknown";
  }
}

function storedNumericMetric(shot: BenchmarkObservation, metric: ClubBenchmarkMetricKey) {
  const value =
    metric === "maxHeightYd"
      ? shot.apexFt
      : metric === "landAngleDeg"
        ? shot.descentAngleDeg
        : shot[metric];
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (metric === "attackAngleDeg" || value > 0)
  );
}

/** Old stored apex values with no unit evidence are not silently treated as verified feet. */
export function benchmarkObservationMetric(
  shot: BenchmarkObservation,
  metric: ClubBenchmarkMetricKey,
): number | null {
  const status = observationMetricStatus(shot, metric);
  if (status === "unknown" || status === "invalid" || status === "unavailable") return null;
  if (metric === "carryYd" || metric === "ballSpeedMph" || metric === "clubSpeedMph")
    return performanceMetricValue(shot, metric);
  let value: number | null | undefined;
  if (metric === "maxHeightYd") {
    const raw = normaliseSourceRawJson(shot.sourceRawJson);
    const explicit = apexHasComparableProvenance(raw, shot.apexFt);
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
          const validIds = new Set(valid.map((s) => s.id));
          return [
            key,
            {
              validCount: valid.length,
              selectedCount: selected.length,
              measuredCount: valid.filter((s) => observationMetricStatus(s, key) === "measured")
                .length,
              estimatedCount: valid.filter((s) => observationMetricStatus(s, key) === "estimated")
                .length,
              excludedNumericCount: selected.filter(
                (s) => !validIds.has(s.id) && storedNumericMetric(s, key),
              ).length,
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
