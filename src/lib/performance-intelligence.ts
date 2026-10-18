import { mean, median, percentile } from "@/lib/analysis-statistics";

/** Product rules, not a statistical confidence model. Quantiles use linear interpolation (R-7). */
export const PERFORMANCE_RULE_VERSION = "performance-intelligence-v1";
export type MetricStatus =
  | "measured"
  | "estimated"
  | "derived"
  | "reconstructed"
  | "unknown"
  | "unavailable"
  | "invalid";
export type PerformanceMetric = "carryYd" | "ballSpeedMph" | "clubSpeedMph" | "sideCarryYd";
export type PerformanceShot = {
  id: string;
  sessionId?: string | null;
  clubId?: string | null;
  shotAt: string | Date;
  carryYd: number | null;
  sideCarryYd?: number | null;
  ballSpeedMph?: number | null;
  clubSpeedMph?: number | null;
  shotCategory?: string | null;
  qualityTag?: string | null;
  reviewStatus?: string | null;
  sessionType?: string | null;
  source?: string | null;
  equipmentId?: string | null;
  settingsKey?: string | null;
  ballType?: string | null;
  environment?: string | null;
  normalization?: string | null;
  intentKey?: string | null;
  canonicalSwingId?: string | null;
  canonicalDuplicateConfirmed?: boolean;
  metricStatus?: Partial<Record<PerformanceMetric, MetricStatus>>;
  directionUsable?: boolean;
};
export type PerformanceOptions = {
  asOf?: Date;
  currentDays?: number;
  baselineDays?: number;
  sessionLimit?: number;
  target?: { carryYd: number; toleranceYd: number; lateralToleranceYd?: number };
};
export type EvidenceReadiness = "Provisional" | "Establishing" | "Well sampled";
export type PerformanceExclusion = { reason: string; count: number; shotIds: string[] };
type Metrics = {
  stockCarryYd: number | null;
  p20Yd: number | null;
  p80Yd: number | null;
  carrySpreadYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  absoluteLateralYd: number | null;
  signedBiasYd: number | null;
  repeatability: number | null;
  mishitRate: number | null;
};
export type PerformanceSession = Metrics & {
  sessionId: string;
  date: string;
  shotIds: string[];
  stockShotIds: string[];
};
export type PerformanceCohort = Metrics & {
  sessionIds: string[];
  shotIds: string[];
  stockShotIds: string[];
  count: number;
  stockCount: number;
  startAt: string | null;
  endAt: string | null;
  readiness: EvidenceReadiness;
  exclusions: PerformanceExclusion[];
  carryObservations: Array<{ shotId: string; carryYd: number; stock: boolean }>;
  metricCounts: Record<PerformanceMetric, number>;
  provenance: Record<PerformanceMetric, Partial<Record<MetricStatus, number>>>;
  sessions: PerformanceSession[];
};
export type PerformanceGroup = {
  id: string;
  observationIds: string[];
  clubId: string | null;
  context: Record<
    | "source"
    | "equipmentId"
    | "settingsKey"
    | "ballType"
    | "environment"
    | "normalization"
    | "intent",
    string | null
  >;
  missingContext: string[];
  exclusions: PerformanceExclusion[];
  potential: {
    startAt: string | null;
    endAt: string | null;
    meanYd: number | null;
    selectedCount: number;
    eligibleCount: number;
    shotIds: string[];
    maximumYd: number | null;
    maximumShotId: string | null;
  };
  current: PerformanceCohort;
  baseline: PerformanceCohort;
  comparison: {
    state: "Improving" | "Holding steady" | "Mixed" | "Needs attention" | "Not enough evidence";
    label: string;
    deltas: Omit<Metrics, "p20Yd" | "p80Yd">;
    method: string;
  };
  recommendation: {
    observation: string;
    shotIds: string[];
    sessionIds: string[];
    comparison: string;
    confidence: EvidenceReadiness;
    limitations: string[];
    action: string;
    successCriterion: string;
    retest: string;
  };
};
export type PerformanceIntelligence = {
  ruleVersion: string;
  asOf: string;
  options: { currentDays: number; baselineDays: number; sessionLimit: number };
  groups: PerformanceGroup[];
};
const severe = new Set(["severe-mishit", "severe_mishit"]);
const mishits = new Set([...severe, "top", "thin", "fat", "mishit"]);
const invalid = new Set([
  "bad-data",
  "bad_data",
  "invalid",
  "misread",
  "launch-monitor-error",
  "launch_monitor_error",
  "excluded",
  "exclude",
  "deleted",
  "delete",
]);
const warmup = new Set(["warm-up", "warmup", "warm_up", "calibration"]);
const normalized = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const timestamp = (shot: PerformanceShot) => new Date(shot.shotAt).getTime();
const sessionKey = (shot: PerformanceShot) => shot.sessionId || "unresolved-session";
function intent(shot: PerformanceShot) {
  return shot.intentKey || normalized(shot.shotCategory) || "unknown";
}
export function performanceObservationExclusionReason(
  shot: Pick<PerformanceShot, "qualityTag" | "reviewStatus" | "shotCategory" | "sessionType">,
) {
  const quality = normalized(shot.qualityTag);
  const review = normalized(shot.reviewStatus);
  if (review === "user_excluded") return "User excluded";
  if ((review !== "restored" && invalid.has(quality)) || review === "launch_monitor_error")
    return "Confirmed invalid observation";
  if (warmup.has(quality) || warmup.has(review) || warmup.has(normalized(shot.shotCategory)))
    return "Warm-up or calibration";
  if (/speed|dry|no.ball/.test(normalized(shot.sessionType)))
    return "Separate speed-training evidence";
  return null;
}
export function performanceMetricValue(shot: PerformanceShot, metric: PerformanceMetric) {
  const status = shot.metricStatus?.[metric];
  if (status === "invalid" || status === "unavailable") return null;
  if (metric === "sideCarryYd" && shot.directionUsable === false) return null;
  const value = shot[metric];
  return finite(value) && (metric === "sideCarryYd" || value > 0) ? value : null;
}
/** Only explicit canonical links deduplicate; equal rounded readings never do. */
function canonicalShots<T extends PerformanceShot>(shots: T[]) {
  const seen = new Set<string>();
  return [...shots]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((shot) => {
      const key =
        shot.canonicalDuplicateConfirmed && shot.canonicalSwingId
          ? `swing:${shot.canonicalSwingId}`
          : `shot:${shot.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
function stockReason(shot: PerformanceShot) {
  if (performanceObservationExclusionReason(shot))
    return performanceObservationExclusionReason(shot);
  if (normalized(shot.shotCategory) !== "full" || (shot.intentKey && shot.intentKey !== "full"))
    return "Not an identified full swing";
  if (severe.has(normalized(shot.qualityTag)))
    return "Explicit severe mishit (retained in all attempts)";
  if (performanceMetricValue(shot, "carryYd") === null) return "Unavailable or invalid carry";
  return null;
}
export function selectPerformancePotentialShots<T extends PerformanceShot>(
  shots: T[],
  limit = 30,
): T[] {
  return canonicalShots(shots)
    .filter((shot) => !stockReason(shot) && !mishits.has(normalized(shot.qualityTag)))
    .sort(
      (a, b) =>
        performanceMetricValue(b, "carryYd")! - performanceMetricValue(a, "carryYd")! ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, Math.floor(limit)));
}
export function performanceReadiness(count: number, sessions: number): EvidenceReadiness {
  return count >= 30 && sessions >= 3
    ? "Well sampled"
    : count >= 10 && sessions >= 2
      ? "Establishing"
      : "Provisional";
}
function summarize(shots: PerformanceShot[], target?: PerformanceOptions["target"]): Metrics {
  const attempts = shots.filter((shot) => !performanceObservationExclusionReason(shot));
  const stock = attempts.filter((shot) => !stockReason(shot));
  const values = (rows: PerformanceShot[], metric: PerformanceMetric) =>
    rows.map((shot) => performanceMetricValue(shot, metric)).filter(finite);
  const carries = values(attempts, "carryYd");
  const stockCarries = values(stock, "carryYd");
  const sides = values(attempts, "sideCarryYd");
  const p20 = percentile(carries, 0.2),
    p80 = percentile(carries, 0.8);
  const targetAttempts = target
    ? attempts.filter(
        (shot) =>
          performanceMetricValue(shot, "carryYd") !== null &&
          (target.lateralToleranceYd === undefined ||
            performanceMetricValue(shot, "sideCarryYd") !== null),
      )
    : [];
  return {
    stockCarryYd: median(stockCarries),
    p20Yd: p20,
    p80Yd: p80,
    carrySpreadYd: p20 === null || p80 === null ? null : p80 - p20,
    ballSpeedMph: median(values(attempts, "ballSpeedMph")),
    clubSpeedMph: median(values(attempts, "clubSpeedMph")),
    absoluteLateralYd: median(sides.map(Math.abs)),
    signedBiasYd: median(sides),
    repeatability:
      target && targetAttempts.length
        ? targetAttempts.filter(
            (shot) =>
              Math.abs(performanceMetricValue(shot, "carryYd")! - target.carryYd) <=
                target.toleranceYd &&
              (target.lateralToleranceYd === undefined ||
                Math.abs(performanceMetricValue(shot, "sideCarryYd")!) <=
                  target.lateralToleranceYd),
          ).length / targetAttempts.length
        : null,
    mishitRate: carries.length
      ? attempts.filter(
          (shot) =>
            performanceMetricValue(shot, "carryYd") !== null &&
            mishits.has(normalized(shot.qualityTag)),
        ).length / carries.length
      : null,
  };
}
function cohort(
  shots: PerformanceShot[],
  target?: PerformanceOptions["target"],
): PerformanceCohort {
  const attempts = shots.filter((shot) => !performanceObservationExclusionReason(shot));
  const stock = attempts.filter((shot) => !stockReason(shot));
  const bySession = new Map<string, PerformanceShot[]>();
  for (const shot of attempts)
    bySession.set(sessionKey(shot), [...(bySession.get(sessionKey(shot)) ?? []), shot]);
  const sessions = [...bySession]
    .map(([sessionId, rows]) => ({
      sessionId,
      date: new Date(Math.min(...rows.map(timestamp))).toISOString(),
      shotIds: rows.map((s) => s.id),
      stockShotIds: rows.filter((s) => !stockReason(s)).map((s) => s.id),
      ...summarize(rows, target),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const reasons = new Map<string, string[]>();
  for (const shot of shots) {
    const reason = stockReason(shot);
    if (reason) reasons.set(reason, [...(reasons.get(reason) ?? []), shot.id]);
  }
  const metricCounts = {} as PerformanceCohort["metricCounts"];
  const provenance = {} as PerformanceCohort["provenance"];
  for (const metric of ["carryYd", "ballSpeedMph", "clubSpeedMph", "sideCarryYd"] as const) {
    const valid = attempts.filter((shot) => performanceMetricValue(shot, metric) !== null);
    metricCounts[metric] = valid.length;
    provenance[metric] = {};
    for (const shot of valid) {
      const status = shot.metricStatus?.[metric] ?? "unknown";
      provenance[metric][status] = (provenance[metric][status] ?? 0) + 1;
    }
  }
  const dates = attempts
    .map(timestamp)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const validCarrySessions = new Set(
    attempts
      .filter((s) => Boolean(s.sessionId) && performanceMetricValue(s, "carryYd") !== null)
      .map(sessionKey),
  );
  return {
    ...summarize(attempts, target),
    sessionIds: sessions.map((s) => s.sessionId),
    shotIds: attempts.map((s) => s.id),
    stockShotIds: stock.map((s) => s.id),
    carryObservations: attempts
      .filter((s) => performanceMetricValue(s, "carryYd") !== null)
      .map((s) => ({
        shotId: s.id,
        carryYd: performanceMetricValue(s, "carryYd")!,
        stock: !stockReason(s),
      })),
    count: metricCounts.carryYd,
    stockCount: stock.length,
    startAt: dates.length ? new Date(dates[0]!).toISOString() : null,
    endAt: dates.length ? new Date(dates.at(-1)!).toISOString() : null,
    readiness: performanceReadiness(metricCounts.carryYd, validCarrySessions.size),
    exclusions: [...reasons].map(([reason, shotIds]) => ({
      reason,
      count: shotIds.length,
      shotIds,
    })),
    metricCounts,
    provenance,
    sessions,
  };
}
const comparisonMetrics = [
  "stockCarryYd",
  "ballSpeedMph",
  "clubSpeedMph",
  "absoluteLateralYd",
  "signedBiasYd",
  "carrySpreadYd",
  "repeatability",
  "mishitRate",
] as const;
function compare(
  current: PerformanceCohort,
  baseline: PerformanceCohort,
  contextComplete: boolean,
): PerformanceGroup["comparison"] {
  const deltas = {} as PerformanceGroup["comparison"]["deltas"];
  for (const metric of comparisonMetrics) {
    const now = median(current.sessions.map((s) => s[metric]).filter(finite));
    const before = median(baseline.sessions.map((s) => s[metric]).filter(finite));
    deltas[metric] = now === null || before === null ? null : now - before;
  }
  // Magnitude thresholds are disclosed product rules. Directional error and spread drive form;
  // more carry/speed alone cannot establish better scoring or shot suitability.
  const directions = (["absoluteLateralYd", "carrySpreadYd"] as const).flatMap((metric) => {
    const delta = deltas[metric];
    const before = median(baseline.sessions.map((s) => s[metric]).filter(finite));
    if (delta === null || before === null) return [];
    const sourceMetric = metric === "absoluteLateralYd" ? "sideCarryYd" : "carryYd";
    const sufficientlyCovered = [current, baseline].every(
      (c) =>
        performanceReadiness(
          c.metricCounts[sourceMetric],
          c.sessions.filter((s) => s[metric] !== null && s.sessionId !== "unresolved-session")
            .length,
        ) !== "Provisional" &&
        !c.provenance[sourceMetric].unknown &&
        !c.provenance[sourceMetric].estimated &&
        !c.provenance[sourceMetric].reconstructed,
    );
    if (!sufficientlyCovered) return [];
    const withinSessionNoise =
      median(
        [...baseline.sessions, ...current.sessions].map((s) => s.carrySpreadYd).filter(finite),
      ) ?? 0;
    const threshold = Math.max(
      2,
      Math.abs(before) * 0.1,
      metric === "carrySpreadYd" ? withinSessionNoise * 0.2 : 0,
    );
    return [Math.abs(delta) < threshold ? 0 : delta < 0 ? 1 : -1];
  });
  const ready = current.readiness !== "Provisional" && baseline.readiness !== "Provisional";
  let state: PerformanceGroup["comparison"]["state"] = "Not enough evidence";
  if (ready && contextComplete && directions.length) {
    state =
      directions.includes(1) && directions.includes(-1)
        ? "Mixed"
        : directions.includes(1)
          ? "Improving"
          : directions.includes(-1)
            ? "Needs attention"
            : "Holding steady";
  }
  return {
    state,
    label:
      state === "Not enough evidence"
        ? "Early signal"
        : `${state} · descriptive session comparison`,
    deltas,
    method:
      "Equal-weight median of session summaries; absolute-error/spread change threshold: max(2 yd, 10% baseline; spread also 20% observed within-session spread). Descriptive product rules, not statistical significance or lasting improvement.",
  };
}
function recommendation(
  current: PerformanceCohort,
  baseline: PerformanceCohort,
  missingContext: string[],
): PerformanceGroup["recommendation"] {
  const limitations = [
    ...missingContext.map((key) => `Unknown ${key}; comparability is limited.`),
    "Observed ranges are not confidence intervals or guarantees.",
    "Contact location, dynamic loft and reliable paired flight inputs have not been established; no swing-mechanics diagnosis.",
  ];
  if (!current.metricCounts.sideCarryYd)
    limitations.push("No usable target-relative lateral measurements.");
  if (current.readiness === "Provisional" || missingContext.length) {
    return {
      observation: `${current.count} valid carry observations across ${current.sessionIds.length} recent sessions; evidence is limited.`,
      shotIds: current.shotIds,
      sessionIds: current.sessionIds,
      comparison: baseline.count
        ? `${baseline.count} baseline carry observations; descriptive comparison only.`
        : "No comparable preceding baseline.",
      confidence: current.readiness,
      limitations,
      action:
        "Record a labelled full-swing retest with the same club, device, ball and settings, saving the intended target window before hitting.",
      successCriterion:
        "Collect at least 10 valid intended attempts across two independent sessions, preserving genuine mishits and measurement flags.",
      retest:
        "Upload the next comparable session; verify intent and context, then compare stock median and all-attempt error/spread against these frozen evidence IDs.",
    };
  }
  const lateralReady =
    performanceReadiness(
      current.metricCounts.sideCarryYd,
      current.sessions.filter(
        (s) => s.absoluteLateralYd !== null && s.sessionId !== "unresolved-session",
      ).length,
    ) !== "Provisional" &&
    !current.provenance.sideCarryYd.unknown &&
    !current.provenance.sideCarryYd.estimated &&
    !current.provenance.sideCarryYd.reconstructed;
  const lateral = lateralReady ? current.absoluteLateralYd : null;
  if (!lateralReady)
    limitations.push(
      "Directional evidence is sparse or its measurement provenance is unresolved; no numerical directional improvement target is justified.",
    );
  return {
    observation:
      lateral === null
        ? `All-attempt middle-60% carry spread is ${current.carrySpreadYd?.toFixed(1) ?? "unavailable"} yd.`
        : `Median absolute lateral error is ${lateral.toFixed(1)} yd; signed bias is a separate measure.`,
    shotIds: current.shotIds,
    sessionIds: current.sessionIds,
    comparison: baseline.count
      ? "Compare equal-weight session medians against the preceding non-overlapping baseline."
      : "No preceding baseline; establish repeatable evidence before claiming improvement.",
    confidence: current.readiness,
    limitations,
    action:
      "Practise one labelled full-swing target block with unchanged equipment and settings; keep every valid intended attempt.",
    successCriterion:
      lateral !== null && lateral > 0
        ? `Product retest target: median absolute lateral error at or below ${(lateral * 0.9).toFixed(1)} yd, with carry spread no worse than the saved baseline.`
        : "Save an explicit carry and lateral target window before the block; measure the fraction of all valid attempts inside it.",
    retest:
      "Collect 10 or more comparable attempts, compare with these saved evidence IDs and repeat in a later independent session to check retention.",
  };
}
export function buildPerformanceIntelligence(
  shots: PerformanceShot[],
  options: PerformanceOptions = {},
): PerformanceIntelligence {
  const asOf = options.asOf ?? new Date();
  if (!Number.isFinite(asOf.getTime())) throw new Error("A valid as-of date is required.");
  const currentDays = options.currentDays ?? 90,
    baselineDays = options.baselineDays ?? 180,
    sessionLimit = options.sessionLimit ?? 5;
  if (
    !Number.isInteger(sessionLimit) ||
    sessionLimit < 1 ||
    sessionLimit > 100 ||
    !Number.isFinite(currentDays) ||
    currentDays <= 0 ||
    !Number.isFinite(baselineDays) ||
    baselineDays < currentDays
  )
    throw new Error("Invalid performance cohort windows.");
  const target = options.target;
  if (
    target &&
    (!finite(target.carryYd) ||
      target.carryYd <= 0 ||
      !finite(target.toleranceYd) ||
      target.toleranceYd < 0 ||
      (target.lateralToleranceYd !== undefined &&
        (!finite(target.lateralToleranceYd) || target.lateralToleranceYd < 0)))
  )
    throw new Error("Invalid saved target window.");
  const byContext = new Map<
    string,
    { context: PerformanceGroup["context"]; shots: PerformanceShot[] }
  >();
  for (const shot of shots) {
    if (!shot.id || !Number.isFinite(timestamp(shot)) || timestamp(shot) > asOf.getTime()) continue;
    const context = {
      source: shot.source ?? null,
      equipmentId: shot.equipmentId ?? null,
      settingsKey: shot.settingsKey ?? null,
      ballType: shot.ballType ?? null,
      environment: shot.environment ?? null,
      normalization: shot.normalization ?? null,
      intent: intent(shot),
    };
    const id = JSON.stringify([shot.clubId ?? null, context]);
    const entry = byContext.get(id) ?? { context, shots: [] };
    entry.shots.push(shot);
    byContext.set(id, entry);
  }
  const day = 86_400_000;
  const groups = [...byContext].map(([id, entry]): PerformanceGroup => {
    const rows = canonicalShots(entry.shots);
    const sessionDates = new Map<string, number>();
    for (const shot of rows.filter((s) => !performanceObservationExclusionReason(s)))
      sessionDates.set(
        sessionKey(shot),
        Math.min(timestamp(shot), sessionDates.get(sessionKey(shot)) ?? Infinity),
      );
    const sessions = [...sessionDates]
      .filter(([, date]) => date >= asOf.getTime() - baselineDays * day)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const currentIds = sessions
      .filter(([, date]) => date >= asOf.getTime() - currentDays * day)
      .slice(0, sessionLimit)
      .map(([key]) => key);
    const oldestCurrent = Math.min(...currentIds.map((key) => sessionDates.get(key)!));
    const baselineIds = currentIds.length
      ? sessions
          .filter(([key, date]) => !currentIds.includes(key) && date < oldestCurrent)
          .slice(0, sessionLimit)
          .map(([key]) => key)
      : [];
    const current = cohort(
      rows.filter((s) => currentIds.includes(sessionKey(s))),
      target,
    );
    const baseline = cohort(
      rows.filter((s) => baselineIds.includes(sessionKey(s))),
      target,
    );
    const eligible = selectPerformancePotentialShots(rows, rows.length);
    const selected = eligible.slice(0, 30);
    const potentialDates = eligible.map(timestamp).sort((a, b) => a - b);
    const missingContext = Object.entries(entry.context)
      .filter(([, value]) => !value || value === "unknown")
      .map(([key]) => key);
    if (rows.some((s) => !s.sessionId)) missingContext.push("session identity");
    const canonicalIds = new Set(rows.map((s) => s.id));
    for (const c of [current, baseline]) {
      const duplicateIds = entry.shots
        .filter((s) => !canonicalIds.has(s.id) && c.sessionIds.includes(sessionKey(s)))
        .map((s) => s.id);
      if (duplicateIds.length)
        c.exclusions.push({
          reason: "Confirmed canonical duplicate",
          count: duplicateIds.length,
          shotIds: duplicateIds,
        });
    }
    return {
      id,
      observationIds: rows.map((s) => s.id),
      clubId: rows[0]?.clubId ?? null,
      context: entry.context,
      missingContext,
      exclusions: cohort(entry.shots, target).exclusions,
      potential: {
        startAt: potentialDates.length ? new Date(potentialDates[0]!).toISOString() : null,
        endAt: potentialDates.length ? new Date(potentialDates.at(-1)!).toISOString() : null,
        meanYd: mean(selected.map((s) => performanceMetricValue(s, "carryYd")!)),
        selectedCount: selected.length,
        eligibleCount: eligible.length,
        shotIds: selected.map((s) => s.id),
        maximumYd: selected.length ? performanceMetricValue(selected[0]!, "carryYd") : null,
        maximumShotId: selected[0]?.id ?? null,
      },
      current,
      baseline,
      comparison: compare(current, baseline, !missingContext.length),
      recommendation: recommendation(current, baseline, missingContext),
    };
  });
  return {
    ruleVersion: PERFORMANCE_RULE_VERSION,
    asOf: asOf.toISOString(),
    options: { currentDays, baselineDays, sessionLimit },
    groups,
  };
}
