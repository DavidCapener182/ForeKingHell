import type { CourseTwinFeature, CourseTwinHole, CourseTwinManifest } from "./course-twin-contract";
import type { CourseTwinTerrainSampler } from "./course-twin-terrain";
import { courseTwinFeatureContains, courseTwinRingArea } from "./course-twin-surface";
import type { SceneryInstance } from "./course-twin-scenery";

// Shared offline/runtime placement. Coordinates and simulation remain authoritative elsewhere.
export function buildTreeInstances(
  features: CourseTwinFeature[],
  holes: CourseTwinHole[],
  terrainBounds: CourseTwinManifest["bounds"],
  sampleTerrain: CourseTwinTerrainSampler,
) {
  const treeFeatures = features.filter((feature) => feature.type === "trees");
  const exclusionFeatures = features.filter((feature) =>
    ["tee", "fairway", "green", "bunker", "water"].includes(feature.type),
  );
  const instances: SceneryInstance[] = [];

  for (const feature of treeFeatures) {
    const ring = feature.rings[0];
    if (!ring || ring.length < 4) continue;
    const xs = ring.map((point) => point[0]);
    const zs = ring.map((point) => point[2]);
    const minX = Math.max(terrainBounds.minX, Math.min(...xs));
    const maxX = Math.min(terrainBounds.maxX, Math.max(...xs));
    const minZ = Math.max(terrainBounds.minZ, Math.min(...zs));
    const maxZ = Math.min(terrainBounds.maxZ, Math.max(...zs));
    if (minX >= maxX || minZ >= maxZ) continue;
    const targetCount = Math.min(96, Math.max(6, Math.round(courseTwinRingArea(ring) / 330)));
    const random = seededRandom(hashString(feature.id));
    let accepted = 0;
    for (let attempt = 0; attempt < targetCount * 28 && accepted < targetCount; attempt += 1) {
      const x = minX + random() * (maxX - minX);
      const z = minZ + random() * (maxZ - minZ);
      if (!courseTwinFeatureContains(feature, x, z)) continue;
      if (exclusionFeatures.some((candidate) => courseTwinFeatureContains(candidate, x, z))) {
        continue;
      }
      const variant = Math.floor(random() * 3);
      const height = 8.5 + random() * 8.5;
      instances.push({
        x,
        y: sampleTerrain(x, z),
        z,
        height,
        widthScale: 0.78 + random() * 0.46,
        tint: random() * 2 - 1,
        variant,
        rotation: random() * Math.PI * 2,
      });
      accepted += 1;
    }
  }
  return [
    ...buildCourseTwinScreenTrees(features, holes, terrainBounds, sampleTerrain),
    ...instances,
  ].slice(0, 650);
}

export function buildBushInstances(
  features: CourseTwinFeature[],
  holes: CourseTwinHole[],
  terrainBounds: CourseTwinManifest["bounds"],
  sampleTerrain: CourseTwinTerrainSampler,
) {
  const treeFeatures = features.filter(
    (feature) => feature.type === "trees" || feature.type === "rough",
  );
  const exclusionFeatures = features.filter((feature) =>
    ["tee", "fairway", "green", "bunker", "water"].includes(feature.type),
  );
  const instances: SceneryInstance[] = [];

  for (const feature of treeFeatures) {
    const ring = feature.rings[0];
    if (!ring || ring.length < 4) continue;
    const xs = ring.map((point) => point[0]);
    const zs = ring.map((point) => point[2]);
    const minX = Math.max(terrainBounds.minX, Math.min(...xs));
    const maxX = Math.min(terrainBounds.maxX, Math.max(...xs));
    const minZ = Math.max(terrainBounds.minZ, Math.min(...zs));
    const maxZ = Math.min(terrainBounds.maxZ, Math.max(...zs));
    if (minX >= maxX || minZ >= maxZ) continue;
    const targetCount = Math.min(126, Math.max(8, Math.round(courseTwinRingArea(ring) / 210)));
    const random = seededRandom(hashString(`${feature.id}:bushes`));
    let accepted = 0;
    for (let attempt = 0; attempt < targetCount * 24 && accepted < targetCount; attempt += 1) {
      const x = minX + random() * (maxX - minX);
      const z = minZ + random() * (maxZ - minZ);
      if (!courseTwinFeatureContains(feature, x, z)) continue;
      if (exclusionFeatures.some((candidate) => courseTwinFeatureContains(candidate, x, z))) {
        continue;
      }
      instances.push({
        x,
        y: sampleTerrain(x, z),
        z,
        height: 1.1 + random() * 2.1,
        widthScale: 0.82 + random() * 0.42,
        tint: random() * 2 - 1,
        variant: Math.floor(random() * 1),
        rotation: random() * Math.PI * 2,
      });
      accepted += 1;
    }
  }
  const screeningBushes = buildCourseTwinScreenTrees(features, holes, terrainBounds, sampleTerrain)
    .filter((_, index) => index % 2 === 0)
    .map((tree, index) => {
      const random = seededRandom(hashString(`screening-bush:${tree.x}:${tree.z}`));
      const distance = 2.6 + random() * 3.8;
      const angle = random() * Math.PI * 2;
      const x = tree.x + Math.cos(angle) * distance;
      const z = tree.z + Math.sin(angle) * distance;
      return {
        x,
        y: sampleTerrain(x, z),
        z,
        height: 1.2 + random() * 1.9,
        widthScale: 0.86 + random() * 0.36,
        tint: random() * 2 - 1,
        variant: index % 1,
        rotation: random() * Math.PI * 2,
      };
    });
  return [...instances, ...screeningBushes].slice(0, 1_200);
}

function buildCourseTwinScreenTrees(
  features: CourseTwinFeature[],
  holes: CourseTwinHole[],
  terrainBounds: CourseTwinManifest["bounds"],
  sampleTerrain: CourseTwinTerrainSampler,
) {
  const exclusions = features.filter((feature) =>
    ["tee", "fairway", "green", "bunker", "water"].includes(feature.type),
  );
  const instances: SceneryInstance[] = [];

  for (const hole of holes) {
    const start = hole.centerline[0] ?? hole.tee;
    const end = hole.centerline.at(-1) ?? hole.green;
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const length = Math.hypot(dx, dz);
    if (length < 1) continue;

    const directionX = dx / length;
    const directionZ = dz / length;
    const sideX = -directionZ;
    const sideZ = directionX;
    const pairs = Math.min(8, Math.max(3, Math.round(length / 78)));
    const random = seededRandom(hashString(`screening:${hole.holeNumber}:${start[0]}:${start[2]}`));

    for (let index = 0; index < pairs; index += 1) {
      const progress = (index + 0.5 + (random() - 0.5) * 0.35) / pairs;
      const along = length * progress;
      for (const side of [-1, 1] as const) {
        const setback = 28 + random() * 38;
        const x = start[0] + directionX * along + sideX * setback * side;
        const z = start[2] + directionZ * along + sideZ * setback * side;
        if (
          x < terrainBounds.minX + 8 ||
          x > terrainBounds.maxX - 8 ||
          z < terrainBounds.minZ + 8 ||
          z > terrainBounds.maxZ - 8 ||
          exclusions.some((feature) => courseTwinFeatureContains(feature, x, z))
        ) {
          continue;
        }
        instances.push({
          x,
          y: sampleTerrain(x, z),
          z,
          height: 8.5 + random() * 8,
          widthScale: 0.78 + random() * 0.5,
          tint: random() * 2 - 1,
          variant: Math.floor(random() * 3),
          rotation: random() * Math.PI * 2,
        });
      }
    }
  }

  return instances.slice(0, 260);
}

export function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}
