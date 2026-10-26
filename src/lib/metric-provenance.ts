/** Metric-level provenance. Unknown units/flags remain unresolved, never guessed. */
export const METRIC_PROVENANCE_VERSION = "metric-provenance-v1";
export type MetricStatus =
  "measured" | "estimated" | "derived" | "reconstructed" | "unknown" | "unavailable" | "invalid";
export type EvidenceMetric =
  | "carryYd"
  | "totalYd"
  | "apexYd"
  | "clubSpeedMph"
  | "ballSpeedMph"
  | "smashFactor"
  | "spinRate"
  | "spinAxisDeg"
  | "attackAngleDeg"
  | "pathDeg"
  | "faceAngleDeg"
  | "launchAngleDeg"
  | "landAngleDeg";
export type MetricUnit =
  "yd" | "ft" | "m" | "mph" | "kph" | "m/s" | "deg" | "rpm" | "ratio" | "unknown";
export type MetricReading = {
  metric: EvidenceMetric;
  value: number | null;
  unit: MetricUnit;
  status: MetricStatus;
  source: string;
  adapterVersion: string;
  observationId?: string;
  /** Only set when a documented adapter understands the manufacturer's flag. */
  flagRecognized?: boolean;
  manufacturerFlag?: string | number | null;
};
export type NormalizedMetricReading = MetricReading & {
  rawValue: number | null;
  rawUnit: MetricUnit;
  comparable: boolean;
  reasonCodes: string[];
  rulesVersion: string;
};

function expectedUnit(metric: EvidenceMetric): MetricUnit {
  if (["carryYd", "totalYd", "apexYd"].includes(metric)) return "yd";
  if (["clubSpeedMph", "ballSpeedMph"].includes(metric)) return "mph";
  if (metric === "spinRate") return "rpm";
  if (metric === "smashFactor") return "ratio";
  return "deg";
}

/** Output carries its normalized unit, so applying this function again never reconverts it. */
export function normalizeMetricReading(input: MetricReading): NormalizedMetricReading {
  const prior = input as Partial<NormalizedMetricReading>;
  const result: NormalizedMetricReading = {
    ...input,
    rawValue: prior.rawValue === undefined ? input.value : prior.rawValue,
    rawUnit: prior.rawUnit ?? input.unit,
    comparable: false,
    reasonCodes: [],
    rulesVersion: METRIC_PROVENANCE_VERSION,
  };
  if (input.value === null || input.status === "unavailable") {
    const status =
      input.status === "invalid" || input.status === "unknown" ? input.status : "unavailable";
    return {
      ...result,
      value: null,
      status,
      reasonCodes: prior.reasonCodes?.length
        ? prior.reasonCodes
        : [
            status === "invalid"
              ? "invalid-metric"
              : status === "unknown"
                ? "unknown-provenance"
                : "missing-metric",
          ],
    };
  }
  if (!Number.isFinite(input.value) || input.status === "invalid") {
    return { ...result, value: null, status: "invalid", reasonCodes: ["invalid-metric"] };
  }
  const targetUnit = expectedUnit(input.metric);
  let value = input.value;
  if (input.unit !== targetUnit) {
    if (targetUnit === "yd" && input.unit === "ft") value /= 3;
    else if (targetUnit === "yd" && input.unit === "m") value /= 0.9144;
    else if (targetUnit === "mph" && input.unit === "kph") value /= 1.609344;
    else if (targetUnit === "mph" && input.unit === "m/s") value *= 2.2369362920544;
    else return { ...result, value: null, status: "unknown", reasonCodes: ["unresolved-unit"] };
  }
  const signed = targetUnit === "deg";
  if (
    (!signed && value < 0) ||
    (["carryYd", "totalYd", "clubSpeedMph", "ballSpeedMph", "smashFactor", "spinRate"].includes(
      input.metric,
    ) &&
      value === 0)
  ) {
    return { ...result, value: null, status: "invalid", reasonCodes: ["invalid-metric"] };
  }
  const unknownFlag =
    input.manufacturerFlag !== null &&
    input.manufacturerFlag !== undefined &&
    input.flagRecognized !== true;
  const status = unknownFlag ? "unknown" : input.status;
  return {
    ...result,
    value,
    unit: targetUnit,
    status,
    comparable: status !== "unknown",
    reasonCodes: unknownFlag
      ? ["unknown-manufacturer-flag"]
      : status === "unknown"
        ? ["unknown-provenance"]
        : [],
  };
}

/** Imported smash stays intact; this separate paired ratio never overwrites it. */
export function derivePairedSmash(
  ball: MetricReading,
  club: MetricReading,
): NormalizedMetricReading {
  const ballReading = normalizeMetricReading(ball);
  const clubReading = normalizeMetricReading(club);
  const validPair =
    Boolean(ball.observationId && ball.observationId === club.observationId) &&
    ball.metric === "ballSpeedMph" &&
    club.metric === "clubSpeedMph" &&
    ballReading.comparable &&
    clubReading.comparable &&
    ballReading.value !== null &&
    clubReading.value !== null &&
    clubReading.value > 0 &&
    ball.source === club.source &&
    ball.adapterVersion === club.adapterVersion;
  return normalizeMetricReading({
    metric: "smashFactor",
    value: validPair ? ballReading.value! / clubReading.value! : null,
    unit: "ratio",
    status: validPair ? "derived" : "unavailable",
    source: ball.source,
    adapterVersion: ball.adapterVersion,
    observationId: ball.observationId,
  });
}
