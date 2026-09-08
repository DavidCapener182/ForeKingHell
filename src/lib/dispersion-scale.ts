export type DispersionScale = {
  maxSideYd: number;
  maxCarryYd: number;
  targetSideYd: number;
};

type DispersionScalePoint = {
  carryYd: number | null;
  sideCarryYd: number | null;
  totalYd?: number | null;
};

/** Round the longest plotted distance up to a 10-yard mark, with a non-zero empty axis. */
export function carryAxisMax(value: number): number {
  return Number.isFinite(value) ? Math.max(10, Math.ceil(value / 10) * 10) : 10;
}

/** Build from the full shot set, before club, trust or outlier filters. */
export function buildDispersionScale(points: readonly DispersionScalePoint[]): DispersionScale {
  let maxSideYd = 50;
  let maxCarryYd = 10;

  for (const point of points) {
    const carry = point.carryYd ?? point.totalYd;
    const side = point.sideCarryYd;
    if (
      typeof carry !== "number" ||
      !Number.isFinite(carry) ||
      typeof side !== "number" ||
      !Number.isFinite(side)
    ) {
      continue;
    }
    maxSideYd = Math.max(maxSideYd, Math.ceil(Math.abs(side) / 50) * 50);
    maxCarryYd = Math.max(maxCarryYd, carryAxisMax(carry));
  }

  return { maxSideYd, maxCarryYd, targetSideYd: 10 };
}
