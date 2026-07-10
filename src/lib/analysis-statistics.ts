export function finiteNumbers(values: Array<number | null | undefined>) {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

export function mean(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function percentile(values: number[], ratio: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.min(1, Math.max(0, ratio)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sorted[lower] ?? sorted[0]!;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

export function median(values: number[]) {
  return percentile(values, 0.5);
}

export function interquartileRange(values: number[]) {
  const low = percentile(values, 0.25);
  const high = percentile(values, 0.75);
  return low === null || high === null ? null : high - low;
}

export function sampleStandardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const average = mean(values) ?? 0;
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function medianAbsoluteDeviation(values: number[]) {
  const centre = median(values);
  return centre === null ? null : median(values.map((value) => Math.abs(value - centre)));
}

export function convexHullArea(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return null;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (
    origin: (typeof sorted)[number],
    a: (typeof sorted)[number],
    b: (typeof sorted)[number],
  ) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const half = (rows: typeof sorted) => {
    const hull: typeof sorted = [];
    for (const point of rows) {
      while (
        hull.length >= 2 &&
        cross(hull[hull.length - 2]!, hull[hull.length - 1]!, point) <= 0
      ) {
        hull.pop();
      }
      hull.push(point);
    }
    return hull;
  };
  const hull = [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
  if (hull.length < 3) return 0;
  const doubleArea = hull.reduce((total, point, index) => {
    const next = hull[(index + 1) % hull.length]!;
    return total + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(doubleArea) / 2;
}
