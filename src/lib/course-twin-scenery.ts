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
  view?: {
    focalPixels: number;
    previous?: { near: number[]; mid: number[] };
    visible?: (p: SceneryInstance) => boolean;
  },
) {
  const near: number[] = [],
    mid: number[] = [];
  const wasNear = new Set(view?.previous?.near);
  const wasMid = new Set(view?.previous?.mid);
  const sorted = instances
    .map((p, index) => ({
      index,
      distance: Math.hypot(p.x - camera.x, p.y - camera.y, p.z - camera.z),
      pixels:
        view && (!view.visible || view.visible(p))
          ? (p.height * view.focalPixels) /
            Math.max(1, Math.hypot(p.x - camera.x, p.y + p.height / 2 - camera.y, p.z - camera.z))
          : 0,
    }))
    .sort((a, b) =>
      view
        ? b.pixels * (wasNear.has(b.index) || wasMid.has(b.index) ? 1.15 : 1) -
            a.pixels * (wasNear.has(a.index) || wasMid.has(a.index) ? 1.15 : 1) || a.index - b.index
        : a.distance - b.distance || a.index - b.index,
    );
  for (const item of sorted) {
    if (view && item.pixels <= 0) continue;
    if (
      (view && !cars
        ? item.pixels > (wasNear.has(item.index) ? 100 : 125)
        : item.distance < (cars ? 250 : high ? 65 : 40)) &&
      near.length < (cars ? (high ? 80 : 30) : high ? 10 : 4)
    )
      near.push(item.index);
    else if (
      (view && !cars
        ? item.pixels > (wasNear.has(item.index) || wasMid.has(item.index) ? 16 : 22)
        : item.distance < (cars ? 700 : high ? 170 : 95)) &&
      mid.length < (cars ? (high ? 80 : 30) : high ? 20 : 8)
    )
      mid.push(item.index);
  }
  const modelled = new Set([...near, ...mid]);
  const far = instances.map((_, i) => i).filter((i) => !modelled.has(i));
  return {
    near,
    mid,
    far,
    visibleFar: view
      ? sorted.filter((p) => p.pixels > 0 && !modelled.has(p.index)).length
      : far.length,
  };
}
