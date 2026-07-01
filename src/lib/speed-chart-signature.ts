export type SpeedChartPoint = {
  label: string;
  value: number;
};

export type SpeedChartSignature = {
  personalBest: SpeedChartPoint | null;
  targetBand: { low: number; high: number; target: number } | null;
  ghostAverage: number | null;
};

export function buildSpeedChartSignature({
  points,
  targetSpeedMph,
  personalBestMph,
}: {
  points: SpeedChartPoint[];
  targetSpeedMph: number | null;
  personalBestMph: number | null;
}): SpeedChartSignature {
  const personalBest =
    points.length > 0
      ? [...points].sort((left, right) => right.value - left.value)[0]
      : personalBestMph
        ? { label: "PB", value: personalBestMph }
        : null;
  const targetBand =
    typeof targetSpeedMph === "number" && Number.isFinite(targetSpeedMph)
      ? {
          low: Math.round((targetSpeedMph - 1.5) * 10) / 10,
          high: Math.round((targetSpeedMph + 1.5) * 10) / 10,
          target: targetSpeedMph,
        }
      : null;
  const ghostPoints = points.slice(-3);
  const ghostAverage =
    ghostPoints.length >= 2
      ? Math.round(
          (ghostPoints.reduce((total, point) => total + point.value, 0) / ghostPoints.length) * 10,
        ) / 10
      : null;

  return {
    personalBest:
      personalBest && personalBestMph !== null && personalBestMph > personalBest.value
        ? { label: "PB", value: personalBestMph }
        : personalBest,
    targetBand,
    ghostAverage,
  };
}
