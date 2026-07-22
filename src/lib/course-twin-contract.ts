export const COURSE_TWIN_SCHEMA_VERSION = 1;
export const COURSE_TWIN_RUNTIME_VERSION = "1.0.0";
export const COURSE_TWIN_REPLAY_MODEL_VERSION = "reconstruction-v1";

export type CourseTwinMode = "flyover" | "replay" | "strategy" | "play";
export type CourseTwinProvenance = "measured" | "derived" | "reconstructed" | "unavailable";
export type CourseTwinPoint = [x: number, elevation: number, z: number];

export type CourseTwinAttribution = {
  label: string;
  url: string;
  licence: string;
};

export type CourseTwinHole = {
  holeNumber: number;
  par: number;
  yards: number;
  strokeIndex: number | null;
  tee: CourseTwinPoint;
  green: CourseTwinPoint;
  centerline: CourseTwinPoint[];
};

export type CourseTwinFeature = {
  id: string;
  holeNumber: number | null;
  type: "fairway" | "green" | "bunker" | "water" | "rough" | "trees" | "course_boundary";
  rings: CourseTwinPoint[][];
  source: string;
};

export type CourseTwinManifest = {
  schemaVersion: number;
  packageVersion: number;
  minimumRuntimeVersion: string;
  course: {
    id: string;
    name: string;
    country: string | null;
  };
  origin: {
    latitude: number;
    longitude: number;
    elevationM: number;
    coordinateSystem: "LOCAL_ENU_METRES";
  };
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  terrain: {
    kind: "prototype_semantic" | "lidar_dtm";
    resolutionM: number | null;
    verticalDatum: string | null;
    warning: string | null;
  };
  quality: {
    grade: "A" | "B" | "C" | "D";
    mappedHoles: number;
    expectedHoles: number;
    mappedFeatures: number;
    verified: boolean;
    warnings: string[];
  };
  supportedModes: CourseTwinMode[];
  holes: CourseTwinHole[];
  features: CourseTwinFeature[];
  attribution: CourseTwinAttribution[];
};

export type CourseTwinEvidenceValue = {
  value: number | null;
  provenance: CourseTwinProvenance;
};

export type CourseTwinReplayShot = {
  id: string;
  holeNumber: number;
  holeShotNumber: number | null;
  clubType: string;
  start: CourseTwinPoint;
  carryEnd: CourseTwinPoint;
  totalEnd: CourseTwinPoint;
  trajectory: CourseTwinPoint[];
  metrics: {
    carryYd: CourseTwinEvidenceValue;
    totalYd: CourseTwinEvidenceValue;
    sideCarryYd: CourseTwinEvidenceValue;
    apexFt: CourseTwinEvidenceValue;
    ballSpeedMph: CourseTwinEvidenceValue;
    launchAngleDeg: CourseTwinEvidenceValue;
    spinRate: CourseTwinEvidenceValue;
    spinAxis: CourseTwinEvidenceValue;
  };
  placementProvenance: "derived";
  trajectoryProvenance: "reconstructed";
  rollProvenance: "reconstructed" | "unavailable";
};

export type CourseTwinReplayDocument = {
  modelVersion: string;
  session: {
    id: string;
    title: string;
    date: string;
    source: string;
  };
  disclosure: string;
  shots: CourseTwinReplayShot[];
};
