export type ShotShapeTraceInput = {
  id: string;
  carryYd: number | null;
  sideCarryYd: number | null;
  launchDirectionDeg?: number | null;
  spinAxis?: number | null;
  maxCarryYd: number;
  maxSideYd: number;
};

export type ShotShapeTrace = {
  id: string;
  path: string;
  landingX: number;
  landingY: number;
  controlX: number;
  controlY: number;
  source: "launch-spin" | "launch" | "spin" | "landing";
};

const START_X = 50;
const START_Y = 88;
const SIDE_SCALE_PERCENT = 38;
const CARRY_SCALE_PERCENT = 72;

export function buildShotShapeTrace(input: ShotShapeTraceInput): ShotShapeTrace | null {
  if (
    !isFiniteNumber(input.carryYd) ||
    !isFiniteNumber(input.sideCarryYd) ||
    !isFiniteNumber(input.maxCarryYd) ||
    !isFiniteNumber(input.maxSideYd) ||
    input.maxCarryYd <= 0 ||
    input.maxSideYd <= 0
  ) {
    return null;
  }

  const landingX = roundTracePoint(
    clampPercent(START_X + (input.sideCarryYd / input.maxSideYd) * SIDE_SCALE_PERCENT, 8, 92),
  );
  const landingY = roundTracePoint(
    clampPercent(START_Y - (input.carryYd / input.maxCarryYd) * CARRY_SCALE_PERCENT, 8, 90),
  );
  const progress = clamp(input.carryYd / input.maxCarryYd, 0.18, 1);
  const endpointOffset = landingX - START_X;
  const launchOffset = isFiniteNumber(input.launchDirectionDeg)
    ? clamp(input.launchDirectionDeg / 12, -1, 1) * 20 * progress
    : null;
  const spinOffset = isFiniteNumber(input.spinAxis)
    ? clamp(input.spinAxis / 35, -1, 1) * 9 * progress
    : null;
  const controlX = roundTracePoint(
    clampPercent(
      START_X + endpointOffset * 0.34 + (launchOffset ?? 0) * 0.55 + (spinOffset ?? 0) * 0.35,
      5,
      95,
    ),
  );
  const controlY = roundTracePoint(START_Y - (START_Y - landingY) * 0.58);

  return {
    id: input.id,
    path: `M ${START_X} ${START_Y} Q ${controlX} ${controlY} ${landingX} ${landingY}`,
    landingX,
    landingY,
    controlX,
    controlY,
    source: traceSource(input.launchDirectionDeg, input.spinAxis),
  };
}

function traceSource(
  launchDirectionDeg: number | null | undefined,
  spinAxis: number | null | undefined,
) {
  const hasLaunch = isFiniteNumber(launchDirectionDeg);
  const hasSpin = isFiniteNumber(spinAxis);

  if (hasLaunch && hasSpin) return "launch-spin";
  if (hasLaunch) return "launch";
  if (hasSpin) return "spin";
  return "landing";
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampPercent(value: number, min: number, max: number) {
  return clamp(value, min, max);
}

function roundTracePoint(value: number) {
  return Math.round(value * 1000) / 1000;
}
