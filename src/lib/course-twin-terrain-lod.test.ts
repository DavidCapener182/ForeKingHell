import { describe, expect, it } from "vitest";
import type { CourseTwinTerrainAsset } from "./course-twin-contract";
import { courseTwinTerrainRenderGrid } from "./course-twin-terrain-lod";
import { createCourseTwinTerrainSampler } from "./course-twin-terrain";

const asset: CourseTwinTerrainAsset = {
  url: "/terrain.f32",
  encoding: "float32_le_relative_metres",
  width: 401,
  height: 301,
  localBounds: { minX: -100, maxX: 100, minZ: -150, maxZ: 150 },
  geographicBounds: { minLatitude: 53, maxLatitude: 54, minLongitude: -3, maxLongitude: -2 },
  minElevationM: 0,
  maxElevationM: 100,
  sha256: "test",
};
describe("balanced Course Twin terrain", () => {
  it("bounds display vertices while preserving course extent, imagery orientation and upward faces", () => {
    const samples = new Float32Array(asset.width * asset.height);
    const grid = courseTwinTerrainRenderGrid(asset, samples);
    expect(grid.positions.length / 3).toBe(193 * 193);
    expect(grid.indices.length / 3).toBe(192 * 192 * 2);
    expect([...grid.positions.slice(0, 3)]).toEqual([-100, 0, -150]);
    expect([...grid.positions.slice(-3)]).toEqual([100, 0, 150]);
    expect([...grid.uv.slice(0, 2)]).toEqual([0, 1]);
    expect([...grid.uv.slice(-2)]).toEqual([1, 0]);
    const [a, b, c] = [...grid.indices.slice(0, 3)].map((i) =>
      grid.positions.slice(i * 3, i * 3 + 3),
    );
    expect((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])).toBeGreaterThan(0);
    expect(grid.indices.reduce((max, value) => Math.max(max, value), 0)).toBeLessThan(
      grid.positions.length / 3,
    );
  });
  it("interpolates display heights without changing full-resolution physics or the input buffer", () => {
    const samples = Float32Array.from(
      { length: asset.width * asset.height },
      (_, i) => (i % asset.width) / 4,
    );
    const before = samples.slice();
    const physics = createCourseTwinTerrainSampler(asset, samples);
    const expected = physics(12.3, 45.6);
    const grid = courseTwinTerrainRenderGrid(asset, samples, 32);
    for (let i = 0; i < grid.positions.length; i += 3)
      expect(grid.positions[i + 1]).toBeCloseTo(
        physics(grid.positions[i], grid.positions[i + 2]),
        4,
      );
    expect(samples).toEqual(before);
    expect(physics(12.3, 45.6)).toBe(expected);
  });
  it("does not upsample small source grids and rejects invalid dimensions", () => {
    expect(
      courseTwinTerrainRenderGrid({ ...asset, width: 2, height: 2 }, new Float32Array(4)).positions
        .length,
    ).toBe(12);
    expect(() =>
      courseTwinTerrainRenderGrid({ ...asset, width: 1 }, new Float32Array(asset.height)),
    ).toThrow("two rows");
  });
});
