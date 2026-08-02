export const SHOT_MAP_MAX_CARRY_YD = 250;
export const SHOT_MAP_MAX_SIDE_YD = 75;
export const SHOT_MAP_DISTANCE_GUIDE_YARDS = [50, 75, 100, 150, 200, 250] as const;

const START_X = 50;
const START_Y = 88;
const SIDE_SCALE_PERCENT = 38;
const CARRY_SCALE_PERCENT = 72;

export function shotMapPointForYards({
  carryYd,
  sideCarryYd,
}: {
  carryYd: number;
  sideCarryYd: number;
}) {
  return {
    x: clamp(START_X + (sideCarryYd / SHOT_MAP_MAX_SIDE_YD) * SIDE_SCALE_PERCENT, 5, 95),
    y: clamp(START_Y - (carryYd / SHOT_MAP_MAX_CARRY_YD) * CARRY_SCALE_PERCENT, 8, 90),
  };
}

export function shotMapGuideY(carryYd: number) {
  return shotMapPointForYards({ carryYd, sideCarryYd: 0 }).y;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
