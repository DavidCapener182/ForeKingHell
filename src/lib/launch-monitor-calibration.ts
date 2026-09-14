export type MonitorConditions = {
  environment: "unknown" | "indoor" | "outdoor";
  ballType: "unknown" | "range" | "premium" | "rpt";
  normalised: "unknown" | "on" | "off";
  ballConversion: "unknown" | "on" | "off";
  recording: "unknown" | "complete" | "partial";
};

export function monitorConditions(value: unknown): MonitorConditions {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  function pick<T extends string>(key: string, choices: readonly T[]): T | "unknown" {
    return choices.includes(input[key] as T) ? (input[key] as T) : "unknown";
  }
  return {
    environment: pick("environment", ["indoor", "outdoor"]),
    ballType: pick("ballType", ["range", "premium", "rpt"]),
    normalised: pick("normalised", ["on", "off"]),
    ballConversion: pick("ballConversion", ["on", "off"]),
    recording: pick("recording", ["complete", "partial"]),
  };
}

export const calibrationMetrics = [
  { key: "ballSpeedMph", label: "Ball speed", unit: "mph", kind: "Speed reading" },
  { key: "clubSpeedMph", label: "Club speed", unit: "mph", kind: "Speed reading" },
  { key: "launchAngleDeg", label: "Launch angle", unit: "°", kind: "Launch reading" },
  { key: "carryYd", label: "Carry", unit: "yd", kind: "Flight-derived" },
  { key: "spinRate", label: "Spin", unit: "rpm", kind: "Ball / setup dependent" },
  { key: "sideCarryYd", label: "Side carry", unit: "yd", kind: "Flight / alignment dependent" },
  { key: "totalYd", label: "Total", unit: "yd", kind: "Ground model dependent" },
] as const;
export type CalibrationMetricKey = (typeof calibrationMetrics)[number]["key"];
export type CalibrationShot = Record<CalibrationMetricKey, number | null> & {
  id: string;
  shotNumber: number | null;
  clubType: string;
  reviewStatus: string;
  sourceRawJson: Record<string, string>;
};

export function medianMetric(shots: CalibrationShot[], key: CalibrationMetricKey) {
  const values = shots
    .map((shot) => shot[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return {
    count: values.length,
    value: values.length
      ? values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2
      : null,
  };
}

/** Exploratory candidates only; carry and spin never influence shot identity. */
export function calibrationCandidates(source: CalibrationShot[], reference: CalibrationShot[]) {
  return source.map((shot) => ({
    shot,
    candidates: reference.filter(
      (other) =>
        shot.clubType !== "unknown" &&
        shot.clubType === other.clubType &&
        (
          [
            ["ballSpeedMph", 3],
            ["launchAngleDeg", 2],
            ["clubSpeedMph", 3],
          ] as const
        ).every(([key, window]) => {
          const a = shot[key],
            b = other[key];
          return (
            typeof a === "number" &&
            Number.isFinite(a) &&
            typeof b === "number" &&
            Number.isFinite(b) &&
            Math.abs(a - b) <= window
          );
        }),
    ),
  }));
}
export function sourceNormalisation(shots: CalibrationShot[]) {
  const states = shots.map((shot) => shot.sourceRawJson.normalise_setting?.toLowerCase());
  const on = states.filter((value) => value === "on").length;
  const off = states.filter((value) => value === "off").length;
  return { on, off, unknown: shots.length - on - off };
}
