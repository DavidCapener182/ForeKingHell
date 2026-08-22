export type SpeedReadingSummary = {
  count: number;
  minSpeedMph: number;
  avgSpeedMph: number;
  maxSpeedMph: number;
};

export type SpeedIndexTone = "amber" | "green" | "sky" | "slate";

export type SpeedIndexSummary = {
  value: number | null;
  label: string;
  tone: SpeedIndexTone;
};

export type SpeedPrescription = {
  priority: "Low" | "Medium" | "High";
  headline: string;
  recommendation: string;
  goal: string;
};

export type SpeedSessionSwingSummary = {
  swingCount: number;
  bestSwingMph: number | null;
  bestThreeAvgMph: number | null;
  bestFiveAvgMph: number | null;
  medianSpeedMph: number | null;
  firstFiveAvgMph: number | null;
  lastFiveAvgMph: number | null;
  warmupGainMph: number | null;
  fatigueDropMph: number | null;
  trendLabel: string;
};

export const SPEED_TRAINING_PHASES = ["warm_up", "max_speed", "transfer"] as const;

export type SpeedTrainingPhase = (typeof SPEED_TRAINING_PHASES)[number];

export type PhasedSpeedSwing = {
  clubSpeedMph: number;
  phase: SpeedTrainingPhase;
};

export type StoredPhasedSpeedSwing = {
  sessionId: string;
  clubSpeedMph: number;
  phase: SpeedTrainingPhase | null;
};

export type SpeedSessionMetricSummary = {
  swingCount: number;
  medianSpeedMph: number | null;
  topThreeAvgMph: number | null;
  topFiveAvgMph: number | null;
  sessionBestMph: number | null;
};

export type RepeatedSpeedPeakSummary = {
  trustedPeakMph: number | null;
  trustedEvidenceCount: number;
  readingCount: number;
  unverifiedPeakMph: number | null;
};

export type SpeedSessionPhaseSummary = SpeedSessionMetricSummary & {
  phase: SpeedTrainingPhase;
};

export type PhasedSpeedSessionSummary = {
  overall: SpeedSessionMetricSummary;
  phases: Record<SpeedTrainingPhase, SpeedSessionPhaseSummary>;
};

export type PersonalShotCorridor = {
  minSideCarryYd: number;
  maxSideCarryYd: number;
};

export type SpeedTransferTestShotEvidence = {
  shotId: string;
  phase: "transfer";
  sideCarryYd: number | null;
  clubSpeedMph?: number | null;
};

/**
 * Links a five-shot transfer test back to the speed session it is intended to validate.
 * This is deliberately a calculation input rather than a persistence model.
 */
export type LinkedSpeedTransferEvidence = {
  speedSessionId: string;
  transferSessionId: string;
  personalCorridor: PersonalShotCorridor;
  shots: readonly SpeedTransferTestShotEvidence[];
};

export type FiveShotTransferPlayability = {
  speedSessionId: string;
  transferSessionId: string;
  requiredShotCount: 5;
  requiredInCorridorCount: 4;
  evaluatedShotIds: string[];
  measuredShotCount: number;
  inCorridorCount: number;
  playabilityPercent: number | null;
  status: "passed" | "failed" | "incomplete";
  isPlayable: boolean | null;
};

const MIN_REASONABLE_SPEED_MPH = 20;
const MAX_REASONABLE_SPEED_MPH = 180;

export function parseSpeedReadings(input: string) {
  const readings: number[] = [];

  for (const line of input.split(/\r?\n/)) {
    const withoutSwingLabels = line.replace(/#\s*\d+\b/g, " ");
    const matches = withoutSwingLabels.match(/-?\d+(?:\.\d+)?/g) ?? [];

    for (const match of matches) {
      const value = Number(match);

      if (
        Number.isFinite(value) &&
        value >= MIN_REASONABLE_SPEED_MPH &&
        value <= MAX_REASONABLE_SPEED_MPH
      ) {
        readings.push(value);
      }
    }
  }

  return readings;
}

export function summarizeSpeedReadings(readings: number[]): SpeedReadingSummary | null {
  const validReadings = readings.filter(
    (value) =>
      Number.isFinite(value) &&
      value >= MIN_REASONABLE_SPEED_MPH &&
      value <= MAX_REASONABLE_SPEED_MPH,
  );

  if (validReadings.length === 0) {
    return null;
  }

  const total = validReadings.reduce((sum, value) => sum + value, 0);

  return {
    count: validReadings.length,
    minSpeedMph: roundSpeed(Math.min(...validReadings)),
    avgSpeedMph: roundSpeed(total / validReadings.length),
    maxSpeedMph: roundSpeed(Math.max(...validReadings)),
  };
}

/**
 * Persists the session headline from the maximum-speed phase only. Warm-up
 * swings still count towards the session's total workload, but never become
 * the session average, maximum, or PB evidence.
 */
export function summarizePhasedReadingsForPersistence(
  readings: readonly PhasedSpeedSwing[],
): SpeedReadingSummary | null {
  const maximumSpeedReadings = readings
    .filter((reading) => reading.phase === "max_speed")
    .map((reading) => reading.clubSpeedMph);
  const summary = summarizeSpeedReadings(maximumSpeedReadings);

  return summary ? { ...summary, count: readings.length } : null;
}

export function selectTrainingPeakReadings(
  sessions: readonly { id: string; maxSpeedMph: number | null }[],
  swings: readonly StoredPhasedSpeedSwing[],
) {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const matchingSwings = swings.filter((swing) => sessionIds.has(swing.sessionId));
  const eligibleSwings = matchingSwings.filter(
    (swing) => swing.phase === null || swing.phase === "max_speed",
  );
  const sessionsWithEligibleSwings = new Set(eligibleSwings.map((swing) => swing.sessionId));
  const summaryOnlyPeaks = sessions.flatMap((session) =>
    !sessionsWithEligibleSwings.has(session.id) && session.maxSpeedMph !== null
      ? [session.maxSpeedMph]
      : [],
  );

  return [...eligibleSwings.map((swing) => swing.clubSpeedMph), ...summaryOnlyPeaks];
}

export function calculateSpeedIndex(
  currentSpeedMph: number | null | undefined,
  targetSpeedMph: number | null | undefined,
): SpeedIndexSummary {
  if (!currentSpeedMph || !targetSpeedMph || targetSpeedMph <= 0) {
    return {
      value: null,
      label: "Set a target",
      tone: "amber",
    };
  }

  const value = currentSpeedMph / targetSpeedMph;

  if (value >= 1) {
    return {
      value,
      label: "Target achieved",
      tone: "green",
    };
  }

  if (value >= 0.9) {
    return {
      value,
      label: "Developing",
      tone: "sky",
    };
  }

  return {
    value,
    label: "Needs work",
    tone: "amber",
  };
}

export function buildSpeedPrescription(input: {
  currentSpeedMph: number | null;
  targetSpeedMph: number | null;
  thirtyDayAvgMph: number | null;
  sessionsLast7Days: number;
}): SpeedPrescription {
  if (!input.currentSpeedMph) {
    return {
      priority: "Medium",
      headline: "Build your first baseline",
      recommendation: "Log one club-speed session this week with the same club or implement.",
      goal: "Capture 8-12 controlled swings so the trend has something real to work from.",
    };
  }

  const target = input.targetSpeedMph ?? input.currentSpeedMph + 5;
  const gap = Math.max(0, target - input.currentSpeedMph);

  if (gap <= 0.2) {
    return {
      priority: "Low",
      headline: "Speed target reached",
      recommendation: "Keep one maintenance session in the week and protect strike quality.",
      goal: `Hold ${formatSpeed(input.currentSpeedMph)} average speed.`,
    };
  }

  if (input.sessionsLast7Days === 0) {
    return {
      priority: gap >= 4 ? "High" : "Medium",
      headline: "No speed work logged this week",
      recommendation: "Add two short speed sessions, separated by at least a day.",
      goal: `Move the session average toward ${formatSpeed(Math.min(target, input.currentSpeedMph + 2))}.`,
    };
  }

  if (input.sessionsLast7Days === 1) {
    return {
      priority: gap >= 4 ? "Medium" : "Low",
      headline: "One speed touch logged",
      recommendation: "Add one more focused session if recovery feels normal.",
      goal: `Beat the 30-day average of ${formatSpeed(input.thirtyDayAvgMph ?? input.currentSpeedMph)}.`,
    };
  }

  return {
    priority: "Low",
    headline: "Speed volume is on track",
    recommendation: "Keep the next session sharp rather than chasing volume.",
    goal: `Look for one swing above ${formatSpeed(Math.min(target, input.currentSpeedMph + gap / 2))}.`,
  };
}

export function summarizeSessionSwings(readings: number[]): SpeedSessionSwingSummary {
  const validReadings = validSpeedReadings(readings);
  const metrics = summarizeSpeedSessionMetrics(validReadings);
  const firstFiveAvgMph = average(validReadings.slice(0, 5));
  const lastFiveAvgMph = average(validReadings.slice(-5));
  const warmupGainMph =
    firstFiveAvgMph !== null && lastFiveAvgMph !== null
      ? roundSpeed(lastFiveAvgMph - firstFiveAvgMph)
      : null;
  const fatigueDropMph =
    firstFiveAvgMph !== null && lastFiveAvgMph !== null
      ? roundSpeed(firstFiveAvgMph - lastFiveAvgMph)
      : null;

  return {
    swingCount: validReadings.length,
    bestSwingMph: metrics.sessionBestMph,
    bestThreeAvgMph: metrics.topThreeAvgMph,
    bestFiveAvgMph: metrics.topFiveAvgMph,
    medianSpeedMph: metrics.medianSpeedMph,
    firstFiveAvgMph,
    lastFiveAvgMph,
    warmupGainMph,
    fatigueDropMph,
    trendLabel: speedSessionTrendLabel(warmupGainMph),
  };
}

/**
 * Returns the core session metrics without presenting a partial sample as a
 * "top three" or "top five" average. Those values remain null until the
 * requested sample size exists.
 */
export function summarizeSpeedSessionMetrics(
  readings: readonly number[],
): SpeedSessionMetricSummary {
  const validReadings = validSpeedReadings(readings);
  const sortedAsc = [...validReadings].sort((left, right) => left - right);
  const sortedDesc = [...sortedAsc].reverse();

  return {
    swingCount: validReadings.length,
    medianSpeedMph: median(sortedAsc),
    topThreeAvgMph: averageAtLeast(sortedDesc, 3),
    topFiveAvgMph: averageAtLeast(sortedDesc, 5),
    sessionBestMph: sortedDesc[0] ?? null,
  };
}

/**
 * A personal-best marker needs a second physical reading within one mph. A
 * single maximum remains visible as an unverified peak instead of silently
 * becoming the golfer's PB.
 */
export function summarizeRepeatedSpeedPeak(readings: readonly number[]): RepeatedSpeedPeakSummary {
  const validReadings = validSpeedReadings(readings).sort((left, right) => right - left);
  const trustedPeak = validReadings.find(
    (candidate) =>
      validReadings.filter((reading) => Math.abs(reading - candidate) <= 1).length >= 2,
  );
  const observedPeak = validReadings[0] ?? null;

  return {
    trustedPeakMph: trustedPeak ?? null,
    trustedEvidenceCount:
      trustedPeak === undefined
        ? 0
        : validReadings.filter((reading) => Math.abs(reading - trustedPeak) <= 1).length,
    readingCount: validReadings.length,
    unverifiedPeakMph:
      observedPeak !== null && (trustedPeak === undefined || observedPeak > trustedPeak)
        ? observedPeak
        : null,
  };
}

export function summarizePhasedSpeedSession(
  swings: readonly PhasedSpeedSwing[],
): PhasedSpeedSessionSummary {
  const phases = Object.fromEntries(
    SPEED_TRAINING_PHASES.map((phase) => [
      phase,
      {
        phase,
        ...summarizeSpeedSessionMetrics(
          swings.filter((swing) => swing.phase === phase).map((swing) => swing.clubSpeedMph),
        ),
      },
    ]),
  ) as Record<SpeedTrainingPhase, SpeedSessionPhaseSummary>;

  return {
    overall: summarizeSpeedSessionMetrics(swings.map((swing) => swing.clubSpeedMph)),
    phases,
  };
}

/**
 * A transfer test passes only when at least four of its first five attempts
 * finish inside (or on the boundary of) the golfer's personal corridor. All
 * five attempts need measurements before the result is complete.
 */
export function evaluateFiveShotTransferPlayability(
  evidence: LinkedSpeedTransferEvidence,
): FiveShotTransferPlayability {
  validatePersonalCorridor(evidence.personalCorridor);

  const evaluatedShots = evidence.shots.filter((shot) => shot.phase === "transfer").slice(0, 5);
  const measuredShots = evaluatedShots.filter((shot) => Number.isFinite(shot.sideCarryYd));
  const inCorridorCount = measuredShots.filter(
    (shot) =>
      (shot.sideCarryYd as number) >= evidence.personalCorridor.minSideCarryYd &&
      (shot.sideCarryYd as number) <= evidence.personalCorridor.maxSideCarryYd,
  ).length;
  const isComplete = evaluatedShots.length === 5 && measuredShots.length === 5;
  const isPlayable = isComplete ? inCorridorCount >= 4 : null;

  return {
    speedSessionId: evidence.speedSessionId,
    transferSessionId: evidence.transferSessionId,
    requiredShotCount: 5,
    requiredInCorridorCount: 4,
    evaluatedShotIds: evaluatedShots.map((shot) => shot.shotId),
    measuredShotCount: measuredShots.length,
    inCorridorCount,
    playabilityPercent: isComplete ? inCorridorCount * 20 : null,
    status: isPlayable === null ? "incomplete" : isPlayable ? "passed" : "failed",
    isPlayable,
  };
}

export function average(values: number[]) {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return null;
  }

  return roundSpeed(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function validSpeedReadings(readings: readonly number[]) {
  return readings.filter(
    (value) =>
      Number.isFinite(value) &&
      value >= MIN_REASONABLE_SPEED_MPH &&
      value <= MAX_REASONABLE_SPEED_MPH,
  );
}

function median(sortedAsc: readonly number[]) {
  if (sortedAsc.length === 0) {
    return null;
  }

  const middle = Math.floor(sortedAsc.length / 2);

  return sortedAsc.length % 2 === 0
    ? roundSpeed((sortedAsc[middle - 1] + sortedAsc[middle]) / 2)
    : roundSpeed(sortedAsc[middle]);
}

function averageAtLeast(sortedDesc: readonly number[], sampleSize: number) {
  return sortedDesc.length >= sampleSize ? average(sortedDesc.slice(0, sampleSize)) : null;
}

function validatePersonalCorridor(corridor: PersonalShotCorridor) {
  if (
    !Number.isFinite(corridor.minSideCarryYd) ||
    !Number.isFinite(corridor.maxSideCarryYd) ||
    corridor.minSideCarryYd > corridor.maxSideCarryYd
  ) {
    throw new RangeError("Personal corridor must have finite, ordered side-carry boundaries.");
  }
}

export function roundSpeed(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatSpeed(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN)
    ? `${roundSpeed(value as number).toFixed(1)} mph`
    : "No data";
}

export function formatSpeedCompact(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN) ? `${roundSpeed(value as number).toFixed(0)} mph` : "-";
}

function speedSessionTrendLabel(warmupGainMph: number | null) {
  if (warmupGainMph === null) {
    return "Need swings";
  }

  if (warmupGainMph >= 2) {
    return "Built speed";
  }

  if (warmupGainMph <= -2) {
    return "Faded late";
  }

  return "Held speed";
}
