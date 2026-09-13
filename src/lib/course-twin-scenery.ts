import type { CourseTwinFeature } from "./course-twin-contract";
import { courseTwinFeatureContains } from "./course-twin-surface";

export type SceneryInstance = {
  x: number;
  y: number;
  z: number;
  height: number;
  widthScale: number;
  tint: number;
  variant: number;
  rotation: number;
};

/** The feature contract currently has no path class; never infer paths from imagery. */
export function sceneryClearOfPlay(instance: SceneryInstance, features: CourseTwinFeature[]) {
  const clearance = Math.min(4, instance.height * 0.22);
  return !features
    .filter((f) => ["tee", "fairway", "green", "bunker", "water"].includes(f.type))
    .some((f) =>
      [
        [0, 0],
        [clearance, 0],
        [-clearance, 0],
        [0, clearance],
        [0, -clearance],
      ].some(([dx, dz]) => courseTwinFeatureContains(f, instance.x + dx, instance.z + dz)),
    );
}

/** Keep the car body and a small margin clear of playing surfaces, not just its centre. */
export function parkedCarClearOfPlay(instance: SceneryInstance, features: CourseTwinFeature[]) {
  const c = Math.cos(instance.rotation),
    s = Math.sin(instance.rotation);
  return [-1.5, 0, 1.5].every((dx) =>
    [-2.7, 0, 2.7].every((dz) =>
      sceneryClearOfPlay(
        {
          ...instance,
          x: instance.x + dx * c + dz * s,
          z: instance.z - dx * s + dz * c,
        },
        features,
      ),
    ),
  );
}

/** Stable distance order: original placement order breaks ties, no random reload changes. */
export function partitionScenery(
  instances: SceneryInstance[],
  camera: { x: number; y: number; z: number },
  high: boolean,
  cars = false,
) {
  const near: number[] = [],
    mid: number[] = [];
  const sorted = instances
    .map((p, index) => ({
      index,
      distance: Math.hypot(p.x - camera.x, p.y - camera.y, p.z - camera.z),
    }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index);
  for (const item of sorted) {
    if (
      item.distance < (cars ? 250 : high ? 65 : 40) &&
      near.length < (cars ? (high ? 80 : 30) : high ? 10 : 4)
    )
      near.push(item.index);
    else if (
      item.distance < (cars ? 700 : high ? 170 : 95) &&
      mid.length < (cars ? (high ? 80 : 30) : high ? 20 : 8)
    )
      mid.push(item.index);
  }
  const modelled = new Set([...near, ...mid]);
  return { near, mid, far: instances.map((_, i) => i).filter((i) => !modelled.has(i)) };
}
