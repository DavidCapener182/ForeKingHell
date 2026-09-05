import type { CourseTwinTerrainAsset } from "./course-twin-contract";
import { createCourseTwinTerrainSampler } from "./course-twin-terrain";

/** Rendering only: the original heightmap remains authoritative for physics and putting. */
export function courseTwinTerrainRenderGrid(
  asset: CourseTwinTerrainAsset,
  samples: Float32Array,
  maxSegments = 192,
) {
  const limit = Math.max(1, Math.min(192, Math.floor(maxSegments) || 192));
  const columns = Math.min(asset.width - 1, limit);
  const rows = Math.min(asset.height - 1, limit);
  if (columns < 1 || rows < 1) throw new Error("Terrain needs at least two rows and columns.");
  const sample = createCourseTwinTerrainSampler(asset, samples);
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const uv = new Float32Array((columns + 1) * (rows + 1) * 2);
  const indices = new Uint32Array(columns * rows * 6);
  const { minX, maxX, minZ, maxZ } = asset.localBounds;
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const index = row * (columns + 1) + column;
      const x = minX + (column / columns) * (maxX - minX);
      const z = minZ + (row / rows) * (maxZ - minZ);
      positions.set([x, sample(x, z), z], index * 3);
      uv.set([column / columns, 1 - row / rows], index * 2);
      if (row < rows && column < columns) {
        const next = index + columns + 1;
        indices.set(
          [index, next, index + 1, index + 1, next, next + 1],
          (row * columns + column) * 6,
        );
      }
    }
  }
  return { positions, uv, indices };
}
