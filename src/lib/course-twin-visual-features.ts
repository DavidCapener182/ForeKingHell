import type { CourseTwinFeature } from "./course-twin-contract";
import { courseTwinFeatureContains } from "./course-twin-surface";

/** Display precedence only. Never changes the authoritative manifest or lie classifier. */
export function courseTwinVisualFeatures(features: CourseTwinFeature[]) {
  const mapped = features.filter((f) => f.source !== "estimated_centerline");
  return features
    .filter((feature) => {
      if (feature.source !== "estimated_centerline") return true;
      const ring = feature.rings[0];
      if (!ring?.length) return false;
      const x = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
      const z = ring.reduce((sum, p) => sum + p[2], 0) / ring.length;
      return !mapped.some(
        (other) => other.type === feature.type && courseTwinFeatureContains(other, x, z),
      );
    })
    .sort(
      (a, b) =>
        Number(b.source === "estimated_centerline") - Number(a.source === "estimated_centerline"),
    );
}
