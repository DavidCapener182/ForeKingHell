export type DispersionPoint = {
  forwardYd: number;
  sideYd: number;
  included?: boolean;
};

export type DispersionEllipse = {
  centerForwardYd: number;
  centerSideYd: number;
  radiusForwardYd: number;
  radiusSideYd: number;
  sampleSize: number;
};

export type DangerHeatSummary = {
  riskScore: number;
  troubleCount: number;
  playableCount: number;
  dominantMiss: "left" | "right" | "short" | "long" | "balanced";
};

export function buildDispersionEllipse(points: DispersionPoint[]): DispersionEllipse | null {
  const included = points.filter((point) => point.included !== false);

  if (included.length < 3) {
    return null;
  }

  const forwardValues = included.map((point) => point.forwardYd);
  const sideValues = included.map((point) => point.sideYd);
  const centerForwardYd = median(forwardValues);
  const centerSideYd = median(sideValues);
  const radiusForwardYd = Math.max(8, percentileDeviation(forwardValues, centerForwardYd, 0.8));
  const radiusSideYd = Math.max(6, percentileDeviation(sideValues, centerSideYd, 0.8));

  return {
    centerForwardYd: roundOne(centerForwardYd),
    centerSideYd: roundOne(centerSideYd),
    radiusForwardYd: roundOne(radiusForwardYd),
    radiusSideYd: roundOne(radiusSideYd),
    sampleSize: included.length,
  };
}

export function buildDangerHeatSummary(
  points: Array<DispersionPoint & { surface?: "playable" | "trouble" | "unavailable" }>,
): DangerHeatSummary {
  const included = points.filter((point) => point.included !== false);
  const trouble = included.filter((point) => point.surface === "trouble");
  const playable = included.filter((point) => point.surface === "playable");
  const centerForward = median(included.map((point) => point.forwardYd));
  const leftCount = trouble.filter((point) => point.sideYd < 0).length;
  const rightCount = trouble.filter((point) => point.sideYd > 0).length;
  const shortCount = trouble.filter((point) => point.forwardYd < centerForward).length;
  const longCount = trouble.filter((point) => point.forwardYd >= centerForward).length;
  const dominant = [
    ["left", leftCount],
    ["right", rightCount],
    ["short", shortCount],
    ["long", longCount],
  ] as const;
  const [dominantMiss, dominantCount] = [...dominant].sort((left, right) => right[1] - left[1])[0];
  const riskScore =
    included.length === 0 ? 0 : Math.round((trouble.length / included.length) * 100);

  return {
    riskScore,
    troubleCount: trouble.length,
    playableCount: playable.length,
    dominantMiss: dominantCount > 0 ? dominantMiss : "balanced",
  };
}

function percentileDeviation(values: number[], center: number, percentile: number) {
  const deviations = values.map((value) => Math.abs(value - center));
  return percentileValue(deviations, percentile);
}

function median(values: number[]) {
  return percentileValue(values, 0.5);
}

function percentileValue(values: number[], percentile: number) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);

  if (sorted.length === 0) {
    return 0;
  }

  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
