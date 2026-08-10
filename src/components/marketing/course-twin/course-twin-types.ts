export type MarketingCourseTwinClub = "three-wood" | "driver";

export type CoursePoint = readonly [x: number, z: number];
export type ScenePoint = readonly [x: number, y: number, z: number];

export type MarketingShotPlan = {
  club: MarketingCourseTwinClub;
  label: "3 Wood" | "Driver";
  expectedCarry: string;
  carryYards: number;
  targetLabel: string;
  missLabel: string;
  trajectoryLabel: string;
  start: CoursePoint;
  landing: CoursePoint;
  controlPoints: readonly CoursePoint[];
  apexMetres: number;
  dispersion: {
    radiusX: number;
    radiusZ: number;
    rotation: number;
  };
  miss: {
    centre: CoursePoint;
    radiusX: number;
    radiusZ: number;
    rotation: number;
  };
};

export type CourseTwinQuality = "compact" | "full";
