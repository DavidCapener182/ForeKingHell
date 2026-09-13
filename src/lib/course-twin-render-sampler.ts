import type { CourseTwinTerrainAsset } from "./course-twin-contract";
import { createCourseTwinTerrainSampler } from "./course-twin-terrain";

/** Decorative surfaces must follow rendered triangles, not the physics bilinear interpolation. */
export function createCourseTwinRenderSampler(
  asset: CourseTwinTerrainAsset,
  samples: Float32Array,
  high: boolean,
) {
  const columns = high ? asset.width - 1 : Math.min(asset.width - 1, 192);
  const rows = high ? asset.height - 1 : Math.min(asset.height - 1, 192);
  const { minX, maxX, minZ, maxZ } = asset.localBounds;
  const source = createCourseTwinTerrainSampler(asset, samples);
  const heights = high
    ? samples
    : Float32Array.from({ length: (columns + 1) * (rows + 1) }, (_, i) =>
        source(
          minX + ((i % (columns + 1)) / columns) * (maxX - minX),
          minZ + (Math.floor(i / (columns + 1)) / rows) * (maxZ - minZ),
        ),
      );
  return (x: number, z: number) => {
    const gx = Math.max(0, Math.min(columns, ((x - minX) / (maxX - minX)) * columns));
    const gz = Math.max(0, Math.min(rows, ((z - minZ) / (maxZ - minZ)) * rows));
    const ix = Math.min(columns - 1, Math.floor(gx)),
      iz = Math.min(rows - 1, Math.floor(gz));
    const u = gx - ix,
      v = gz - iz,
      i = iz * (columns + 1) + ix;
    const a = heights[i],
      b = heights[i + 1],
      c = heights[i + columns + 1],
      d = heights[i + columns + 2];
    return u + v <= 1
      ? a * (1 - u - v) + b * u + c * v
      : b * (1 - v) + c * (1 - u) + d * (u + v - 1);
  };
}
