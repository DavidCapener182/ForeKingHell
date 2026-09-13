import { describe, it, expect } from "vitest";
import type { CourseTwinTerrainAsset } from "./course-twin-contract";
import { createCourseTwinRenderSampler } from "./course-twin-render-sampler";
import { courseTwinTerrainRenderGrid } from "./course-twin-terrain-lod";
const asset = {
  width: 2,
  height: 2,
  localBounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 },
} as CourseTwinTerrainAsset;
describe("decorative terrain draping", () => {
  it.each([true, false])(
    "follows the rendered diagonal rather than a bilinear saddle (high=%s)",
    (high) => {
      const samples = new Float32Array([0, 0, 0, 10]);
      const sample = createCourseTwinRenderSampler(asset, samples, high);
      expect(sample(0.5, 0.5)).toBe(0);
      expect(sample(0.75, 0.75)).toBe(5);
      expect(sample(1, 1)).toBe(10);
      expect(sample(-2, -2)).toBe(0);
      expect([...samples]).toEqual([0, 0, 0, 10]);
    },
  );
  it("matches reduced terrain triangle interpolation", () => {
    const large = { ...asset, width: 257, height: 257 };
    const samples = Float32Array.from({ length: 257 * 257 }, (_, i) => Math.sin(i * 0.07) * 3);
    const grid = courseTwinTerrainRenderGrid(large, samples);
    const sample = createCourseTwinRenderSampler(large, samples, false);
    for (let i = 0; i < grid.indices.length; i += 234) {
      const ids = [grid.indices[i], grid.indices[i + 1], grid.indices[i + 2]];
      const avg = (axis: number) =>
        ids.reduce((sum, id) => sum + grid.positions[id * 3 + axis], 0) / 3;
      expect(sample(avg(0), avg(2))).toBeCloseTo(avg(1), 3);
    }
  });
});
