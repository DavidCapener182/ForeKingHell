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
  curveYd: number | null;
  source: "estimated" | "straight";
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
    input.carryYd <= 0 ||
    input.maxCarryYd <= 0 ||
    input.maxSideYd <= 0
  ) {
    return null;
  }

  const carryYd = input.carryYd;
  const sideCarryYd = input.sideCarryYd;
  const maxCarryYd = input.maxCarryYd;
  const maxSideYd = input.maxSideYd;

  const landing = svgPointForYards({
    offlineYd: sideCarryYd,
    downrangeYd: carryYd,
    maxCarryYd,
    maxSideYd,
  });

  if (!isFiniteNumber(input.launchDirectionDeg)) {
    return {
      id: input.id,
      path: `M ${START_X} ${START_Y} L ${landing.x} ${landing.y}`,
      landingX: landing.x,
      landingY: landing.y,
      curveYd: null,
      source: "straight",
    };
  }

  const theta = (input.launchDirectionDeg * Math.PI) / 180;
  const startSlope = Math.tan(theta);
  const bendCoefficient = (sideCarryYd - startSlope * carryYd) / (carryYd * carryYd);
  const pathPoints = Array.from({ length: 41 }, (_, index) => {
    const downrangeYd = carryYd * (index / 40);
    const offlineYd = bendCoefficient * downrangeYd * downrangeYd + startSlope * downrangeYd;

    return svgPointForYards({
      offlineYd,
      downrangeYd,
      maxCarryYd,
      maxSideYd,
    });
  });
  const path = pathPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return {
    id: input.id,
    path,
    landingX: landing.x,
    landingY: landing.y,
    curveYd: roundTracePoint(sideCarryYd - startSlope * carryYd),
    source: "estimated",
  };
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function svgPointForYards({
  offlineYd,
  downrangeYd,
  maxCarryYd,
  maxSideYd,
}: {
  offlineYd: number;
  downrangeYd: number;
  maxCarryYd: number;
  maxSideYd: number;
}) {
  return {
    x: roundTracePoint(clampPercent(START_X + (offlineYd / maxSideYd) * SIDE_SCALE_PERCENT, 5, 95)),
    y: roundTracePoint(
      clampPercent(START_Y - (downrangeYd / maxCarryYd) * CARRY_SCALE_PERCENT, 8, 90),
    ),
  };
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
