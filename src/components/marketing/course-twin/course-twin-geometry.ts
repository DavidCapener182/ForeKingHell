import * as THREE from "three";

import { terrainHeight } from "./course-twin-data";
import type { CoursePoint } from "./course-twin-types";

function finaliseGeometry(
  positions: number[],
  uvs: number[],
  indices: number[],
  colours?: number[],
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (colours) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createTerrainGeometry(segmentsX: number, segmentsZ: number) {
  const width = 66;
  const depth = 106;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];

  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const zRatio = zIndex / segmentsZ;
    const z = depth / 2 - zRatio * depth;
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const xRatio = xIndex / segmentsX;
      const x = xRatio * width - width / 2;
      const height = terrainHeight(x, z);
      const shade = 0.9 + Math.sin(x * 0.23 + z * 0.11) * 0.035;
      positions.push(x, height, z);
      uvs.push(xRatio, zRatio);
      colours.push(shade * 0.93, shade, shade * 0.91);
    }
  }

  const row = segmentsX + 1;
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const a = zIndex * row + xIndex;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  return finaliseGeometry(positions, uvs, indices, colours);
}

function courseCurve(points: readonly CoursePoint[]) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
    0.42,
  );
}

function sampleWidth(widths: readonly number[], t: number) {
  const position = t * (widths.length - 1);
  const index = Math.min(widths.length - 2, Math.floor(position));
  const blend = position - index;
  return THREE.MathUtils.lerp(widths[index] ?? widths[0] ?? 1, widths[index + 1] ?? 1, blend);
}

export function createCourseStripGeometry({
  points,
  widths,
  samples,
  edgeSeed,
  elevation = 0.035,
}: {
  points: readonly CoursePoint[];
  widths: readonly number[];
  samples: number;
  edgeSeed: number;
  elevation?: number;
}) {
  const curve = courseCurve(points);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(Math.min(0.999, Math.max(0.001, t))).normalize();
    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const width = sampleWidth(widths, t);
    const leftNoise =
      1 +
      Math.sin(index * 1.73 + edgeSeed * 0.61) * 0.045 +
      Math.sin(index * 0.47 + edgeSeed) * 0.028;
    const rightNoise =
      1 +
      Math.sin(index * 1.31 + edgeSeed * 1.17) * 0.052 +
      Math.cos(index * 0.39 + edgeSeed) * 0.025;
    const left = point.clone().addScaledVector(perpendicular, width * leftNoise);
    const right = point.clone().addScaledVector(perpendicular, -width * rightNoise);
    positions.push(left.x, terrainHeight(left.x, left.z) + elevation, left.z);
    positions.push(right.x, terrainHeight(right.x, right.z) + elevation, right.z);
    uvs.push(0, t, 1, t);
    if (index < samples) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  return finaliseGeometry(positions, uvs, indices);
}

export function createIrregularDiscGeometry({
  centre,
  radii,
  rotation = 0,
  segments = 52,
  rings = 4,
  seed = 1,
  elevation = 0.05,
  bowlDepth = 0,
}: {
  centre: CoursePoint;
  radii: CoursePoint;
  rotation?: number;
  segments?: number;
  rings?: number;
  seed?: number;
  elevation?: number;
  bowlDepth?: number;
}) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const [centreX, centreZ] = centre;
  const [radiusX, radiusZ] = radii;
  positions.push(centreX, terrainHeight(centreX, centreZ) + elevation - bowlDepth, centreZ);
  uvs.push(0.5, 0.5);

  for (let ring = 1; ring <= rings; ring += 1) {
    const ringRatio = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const edgeNoise =
        1 +
        ringRatio *
          (Math.sin(angle * 3 + seed * 0.73) * 0.055 + Math.cos(angle * 7 + seed * 1.29) * 0.025);
      const localX = Math.cos(angle) * radiusX * ringRatio * edgeNoise;
      const localZ = Math.sin(angle) * radiusZ * ringRatio * edgeNoise;
      const rotatedX = localX * Math.cos(rotation) - localZ * Math.sin(rotation);
      const rotatedZ = localX * Math.sin(rotation) + localZ * Math.cos(rotation);
      const x = centreX + rotatedX;
      const z = centreZ + rotatedZ;
      const bowl = bowlDepth * (1 - ringRatio ** 1.6);
      positions.push(x, terrainHeight(x, z) + elevation - bowl, z);
      uvs.push(0.5 + (localX / radiusX) * 0.5, 0.5 + (localZ / radiusZ) * 0.5);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, 1 + ((segment + 1) % segments), 1 + segment);
  }
  for (let ring = 1; ring < rings; ring += 1) {
    const innerStart = 1 + (ring - 1) * segments;
    const outerStart = innerStart + segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      indices.push(
        innerStart + segment,
        innerStart + next,
        outerStart + segment,
        innerStart + next,
        outerStart + next,
        outerStart + segment,
      );
    }
  }

  return finaliseGeometry(positions, uvs, indices);
}

export function createIrregularRingGeometry({
  centre,
  radii,
  thickness,
  rotation = 0,
  segments = 52,
  seed = 1,
  elevation = 0.08,
}: {
  centre: CoursePoint;
  radii: CoursePoint;
  thickness: number;
  rotation?: number;
  segments?: number;
  seed?: number;
  elevation?: number;
}) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const [centreX, centreZ] = centre;
  const [radiusX, radiusZ] = radii;

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    const noise =
      1 + Math.sin(angle * 3 + seed * 0.73) * 0.055 + Math.cos(angle * 7 + seed) * 0.025;
    for (const edge of [0, 1]) {
      const scale = edge === 0 ? 1 : Math.max(0.2, 1 - thickness / Math.max(radiusX, radiusZ));
      const localX = Math.cos(angle) * radiusX * noise * scale;
      const localZ = Math.sin(angle) * radiusZ * noise * scale;
      const x = centreX + localX * Math.cos(rotation) - localZ * Math.sin(rotation);
      const z = centreZ + localX * Math.sin(rotation) + localZ * Math.cos(rotation);
      const lip = edge === 0 ? 0.03 : 0;
      positions.push(x, terrainHeight(x, z) + elevation + lip, z);
      uvs.push(segment / segments, edge);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const outer = segment * 2;
    const inner = outer + 1;
    const nextOuter = next * 2;
    const nextInner = nextOuter + 1;
    indices.push(outer, inner, nextOuter, inner, nextInner, nextOuter);
  }

  return finaliseGeometry(positions, uvs, indices);
}
