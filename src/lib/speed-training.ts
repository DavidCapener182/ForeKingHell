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
  firstFiveAvgMph: number | null;
  lastFiveAvgMph: number | null;
  warmupGainMph: number | null;
  fatigueDropMph: number | null;
  trendLabel: string;
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
  const validReadings = readings.filter(
    (value) =>
      Number.isFinite(value) &&
      value >= MIN_REASONABLE_SPEED_MPH &&
      value <= MAX_REASONABLE_SPEED_MPH,
  );
  const sortedDesc = [...validReadings].sort((left, right) => right - left);
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
    bestSwingMph: sortedDesc[0] ?? null,
    bestThreeAvgMph: average(sortedDesc.slice(0, 3)),
    firstFiveAvgMph,
    lastFiveAvgMph,
    warmupGainMph,
    fatigueDropMph,
    trendLabel: speedSessionTrendLabel(warmupGainMph),
  };
}

export function average(values: number[]) {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return null;
  }

  return roundSpeed(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
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
