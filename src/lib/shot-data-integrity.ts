export type ShotDataIntegrityIssue = "trajectory-review";

export type ShotDataIntegrityInput = {
  clubType: string;
  shotCategory: string | null;
  carryYd: number | null;
  totalYd: number | null;
  launchAngleDeg: number | null;
  apexFt: number | null;
};

const SCORING_WEDGE_TYPES = new Set(["pw", "gw", "aw", "sw", "lw", "wedge"]);

/**
 * Holds out a narrow class of launch-monitor rows that fall outside a normal full wedge trajectory.
 * The original row remains visible in Raw data for a golfer to inspect.
 */
export function detectShotDataIntegrityIssue(
  shot: ShotDataIntegrityInput,
): ShotDataIntegrityIssue | null {
  if (!SCORING_WEDGE_TYPES.has(shot.clubType.trim().toLowerCase())) {
    return null;
  }

  if (shot.shotCategory && shot.shotCategory.toLowerCase() !== "full") {
    return null;
  }

  if (
    !isNumber(shot.carryYd) ||
    !isNumber(shot.totalYd) ||
    !isNumber(shot.launchAngleDeg) ||
    !isNumber(shot.apexFt)
  ) {
    return null;
  }

  const rolloutYd = shot.totalYd - shot.carryYd;
  const exceptionalRollout = rolloutYd >= Math.max(20, shot.carryYd * 0.4);
  const lowFlight = shot.launchAngleDeg <= 10 && shot.apexFt <= 10;

  return exceptionalRollout && lowFlight ? "trajectory-review" : null;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
