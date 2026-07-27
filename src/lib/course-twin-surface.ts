import type {
  CourseTwinFeature,
  CourseTwinManifest,
  CourseTwinPoint,
} from "@/lib/course-twin-contract";

export type CourseTwinSurface =
  | "tee"
  | "fairway"
  | "green"
  | "rough"
  | "bunker"
  | "water"
  | "trees"
  | "out_of_bounds";

type CourseTwinPlayableFeatureType = Exclude<CourseTwinFeature["type"], "course_boundary">;

const SURFACE_PRIORITY: CourseTwinPlayableFeatureType[] = [
  "water",
  "bunker",
  "green",
  "tee",
  "fairway",
  "trees",
  "rough",
];

export function createCourseTwinSurfaceClassifier(
  manifest: Pick<CourseTwinManifest, "features">,
  holeNumber?: number | null,
) {
  const playableFeatures = manifest.features.filter(
    (feature) => feature.type !== "course_boundary",
  );
  const boundaries = manifest.features.filter(
    (feature) =>
      feature.type === "course_boundary" &&
      (holeNumber == null || feature.holeNumber == null || feature.holeNumber === holeNumber),
  );

  return (x: number, z: number): CourseTwinSurface => {
    for (const type of SURFACE_PRIORITY) {
      if (
        playableFeatures.some(
          (feature) => feature.type === type && courseTwinFeatureContains(feature, x, z),
        )
      ) {
        return type;
      }
    }
    if (
      boundaries.length > 0 &&
      !boundaries.some((feature) => courseTwinFeatureContains(feature, x, z))
    ) {
      return "out_of_bounds";
    }
    return "rough";
  };
}

export function courseTwinFeatureContains(feature: CourseTwinFeature, x: number, z: number) {
  if (feature.rings.length === 0 || !pointInCourseTwinRing(feature.rings[0], x, z)) return false;
  return !feature.rings.slice(1).some((ring) => pointInCourseTwinRing(ring, x, z));
}

export function pointInCourseTwinRing(ring: CourseTwinPoint[], x: number, z: number) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const currentX = ring[current][0];
    const currentZ = ring[current][2];
    const previousX = ring[previous][0];
    const previousZ = ring[previous][2];
    const intersects =
      currentZ > z !== previousZ > z &&
      x <
        ((previousX - currentX) * (z - currentZ)) / (previousZ - currentZ || Number.EPSILON) +
          currentX;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function courseTwinRingArea(ring: CourseTwinPoint[]) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[2] - next[0] * current[2];
  }
  return Math.abs(area) / 2;
}
