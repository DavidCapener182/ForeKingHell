import type { CoursePoint, MarketingCourseTwinClub, MarketingShotPlan } from "./course-twin-types";

export const COURSE_CENTRE_LINE: readonly CoursePoint[] = [
  [0.5, 43],
  [-1.5, 31],
  [-4.2, 19],
  [-2.8, 7],
  [1.2, -5],
  [0.1, -17],
  [-3.6, -29],
  [-2.4, -42],
];

export const FAIRWAY_WIDTHS = [5.4, 7.2, 8.8, 10.5, 10.8, 9.3, 7.1, 5.1] as const;

export const CART_PATH: readonly CoursePoint[] = [
  [-11.8, 45],
  [-13.5, 31],
  [-15.4, 17],
  [-14.1, 2],
  [-12.3, -14],
  [-11.7, -29],
  [-9.2, -43],
];

export const SHOT_PLANS: Record<MarketingCourseTwinClub, MarketingShotPlan> = {
  "three-wood": {
    club: "three-wood",
    label: "3 Wood",
    expectedCarry: "214–224 yd",
    carryYards: 219,
    targetLabel: "Left-centre fairway",
    missLabel: "Right first cut",
    trajectoryLabel: "Controlled flight",
    start: [0.5, 40.5],
    landing: [-2.9, -13.8],
    controlPoints: [
      [0.5, 40.5],
      [-1.4, 25],
      [-3.8, 6],
      [-2.9, -13.8],
    ],
    apexMetres: 7.6,
    dispersion: { radiusX: 4.4, radiusZ: 7.1, rotation: -0.16 },
    miss: {
      centre: [6.4, -14.7],
      radiusX: 3.8,
      radiusZ: 6.1,
      rotation: -0.22,
    },
  },
  driver: {
    club: "driver",
    label: "Driver",
    expectedCarry: "234–249 yd",
    carryYards: 242,
    targetLabel: "Narrow right-centre window",
    missLabel: "Right water edge",
    trajectoryLabel: "Higher, longer flight",
    start: [0.5, 40.5],
    landing: [1.2, -24.7],
    controlPoints: [
      [0.5, 40.5],
      [-0.5, 22],
      [1.7, -1],
      [1.2, -24.7],
    ],
    apexMetres: 10.8,
    dispersion: { radiusX: 6.8, radiusZ: 10.2, rotation: -0.23 },
    miss: {
      centre: [9.4, -23.2],
      radiusX: 5.4,
      radiusZ: 8.2,
      rotation: -0.32,
    },
  },
};

export function seededUnit(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export function terrainHeight(x: number, z: number) {
  const longRoll = Math.sin((z + 17) * 0.083) * 0.72;
  const crossFall = Math.cos((x - 4) * 0.15) * 0.38;
  const distantShoulder = Math.max(0, Math.abs(x) - 12) * 0.055;
  const greenRise = Math.exp(-((x + 2.4) ** 2 / 72 + (z + 40) ** 2 / 120)) * 0.78;
  const drainageDip = Math.exp(-((x - 11) ** 2 / 50 + (z + 17) ** 2 / 290)) * -0.62;
  return longRoll + crossFall + distantShoulder + greenRise + drainageDip;
}
