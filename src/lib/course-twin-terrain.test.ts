import { describe, expect, it } from "vitest";

import type { CourseTwinTerrainAsset } from "@/lib/course-twin-contract";
import {
  createCourseTwinTerrainSampler,
  decodeCourseTwinHeightmap,
} from "@/lib/course-twin-terrain";

const asset: CourseTwinTerrainAsset = {
  url: "/terrain.f32",
  encoding: "float32_le_relative_metres",
  width: 2,
  height: 2,
  localBounds: { minX: -10, maxX: 10, minZ: -20, maxZ: 20 },
  geographicBounds: {
    minLatitude: 53,
    maxLatitude: 54,
    minLongitude: -3,
    maxLongitude: -2,
  },
  minElevationM: 10,
  maxElevationM: 40,
  sha256: "test",
};

describe("Course Twin terrain package", () => {
  it("decodes little-endian floats and rejects truncated packages", () => {
    const source = new Float32Array([0, 10, 20, 30]);
    expect([...decodeCourseTwinHeightmap(source.buffer, asset)]).toEqual([0, 10, 20, 30]);
    expect(() => decodeCourseTwinHeightmap(source.buffer.slice(0, 8), asset)).toThrow(
      /size mismatch/,
    );
  });

  it("samples the raster bilinearly in local course coordinates", () => {
    const sample = createCourseTwinTerrainSampler(asset, new Float32Array([0, 10, 20, 30]));
    expect(sample(-10, -20)).toBe(0);
    expect(sample(10, 20)).toBe(30);
    expect(sample(0, 0)).toBe(15);
    expect(sample(-100, -100)).toBe(0);
  });
});
