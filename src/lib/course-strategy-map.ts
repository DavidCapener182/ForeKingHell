import type { CourseTwinManifest } from "@/lib/course-twin-contract";

export type CourseStrategyMapPoint = [x: number, z: number];

export type CourseStrategyMap = {
  imageUrl: string | null;
  attribution: string | null;
  bounds: CourseTwinManifest["bounds"];
  holes: Array<{
    holeNumber: number;
    tee: CourseStrategyMapPoint;
    green: CourseStrategyMapPoint;
    centerline: CourseStrategyMapPoint[];
  }>;
  features: Array<{
    id: string;
    holeNumber: number | null;
    type: "tee" | "fairway" | "green" | "bunker" | "water";
    rings: CourseStrategyMapPoint[][];
  }>;
};

export function courseStrategyMapFromManifest(
  manifest: CourseTwinManifest | null,
): CourseStrategyMap | null {
  if (!manifest || manifest.holes.length === 0) return null;

  return {
    imageUrl: manifest.terrain.imagery?.url ?? null,
    attribution: manifest.terrain.imagery?.attribution ?? null,
    bounds: manifest.bounds,
    holes: manifest.holes.map((hole) => ({
      holeNumber: hole.holeNumber,
      tee: flattenPoint(hole.tee),
      green: flattenPoint(hole.green),
      centerline: hole.centerline.map(flattenPoint),
    })),
    features: manifest.features.flatMap((feature) => {
      if (!isVisibleMapFeature(feature.type)) return [];
      return [
        {
          id: feature.id,
          holeNumber: feature.holeNumber,
          type: feature.type,
          rings: feature.rings.map((ring) => ring.map(flattenPoint)),
        },
      ];
    }),
  };
}

function flattenPoint(point: [number, number, number]): CourseStrategyMapPoint {
  return [point[0], point[2]];
}

function isVisibleMapFeature(
  type: CourseTwinManifest["features"][number]["type"],
): type is CourseStrategyMap["features"][number]["type"] {
  return (
    type === "tee" ||
    type === "fairway" ||
    type === "green" ||
    type === "bunker" ||
    type === "water"
  );
}
