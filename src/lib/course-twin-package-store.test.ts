import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import {
  courseTwinStoragePath,
  decodeCourseTwinWorkerAsset,
  replaceWorkerAssetReferences,
  resolveCourseTwinAssetReferences,
  verifyCourseTwinManifest,
} from "@/lib/course-twin-package-store";

const courseId = "9beb5429-67e4-4f4e-a187-adbe0df74b62";
const manifest: CourseTwinManifest = {
  schemaVersion: 1,
  packageVersion: 4,
  minimumRuntimeVersion: "1.0.0",
  course: { id: courseId, name: "Bootle", country: "England" },
  origin: {
    latitude: 53.48,
    longitude: -2.97,
    elevationM: 5,
    coordinateSystem: "LOCAL_ENU_METRES",
  },
  bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
  terrain: {
    kind: "lidar_dtm",
    resolutionM: 1,
    verticalDatum: "ODN",
    warning: null,
    heightmap: null,
    imagery: null,
  },
  quality: {
    grade: "B",
    mappedHoles: 18,
    expectedHoles: 18,
    mappedFeatures: 50,
    verified: false,
    warnings: [],
  },
  supportedModes: ["flyover", "replay"],
  holes: [],
  features: [],
  attribution: [],
};

describe("Course Twin immutable package store", () => {
  it("creates scoped version paths and rejects traversal", () => {
    expect(courseTwinStoragePath(courseId, 4, "manifest.json")).toBe(
      `${courseId}/v4/manifest.json`,
    );
    expect(() => courseTwinStoragePath(courseId, 4, "../manifest.json")).toThrow(/file name/);
    expect(() => courseTwinStoragePath(courseId, 0, "manifest.json")).toThrow(/version/);
  });

  it("verifies manifest integrity, course ownership and runtime compatibility", () => {
    const bytes = Buffer.from(JSON.stringify(manifest));
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(verifyCourseTwinManifest(bytes, digest, courseId).packageVersion).toBe(4);
    expect(() => verifyCourseTwinManifest(bytes, "0".repeat(64), courseId)).toThrow(/integrity/);
    expect(() =>
      verifyCourseTwinManifest(bytes, digest, "00000000-0000-0000-0000-000000000000"),
    ).toThrow(/different course/);
  });

  it("rejects a package that needs a newer runtime", () => {
    const bytes = Buffer.from(JSON.stringify({ ...manifest, minimumRuntimeVersion: "99.0.0" }));
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(() => verifyCourseTwinManifest(bytes, digest, courseId)).toThrow(/newer runtime/);
  });

  it("integrity-checks worker assets and converts private storage references to signed URLs", async () => {
    const terrainBytes = Buffer.from("course-twin-terrain");
    const terrainAsset = {
      fileName: "terrain.f32",
      contentType: "application/octet-stream" as const,
      sha256: createHash("sha256").update(terrainBytes).digest("hex"),
      dataBase64: terrainBytes.toString("base64"),
    };
    expect(decodeCourseTwinWorkerAsset(terrainAsset)).toEqual(terrainBytes);
    expect(() => decodeCourseTwinWorkerAsset({ ...terrainAsset, sha256: "0".repeat(64) })).toThrow(
      /integrity/,
    );

    const manifestWithAsset = {
      ...manifest,
      terrain: {
        ...manifest.terrain,
        heightmap: {
          url: "asset://terrain.f32",
          encoding: "float32_le_relative_metres" as const,
          width: 2,
          height: 2,
          localBounds: manifest.bounds,
          geographicBounds: {
            minLatitude: 53.47,
            maxLatitude: 53.49,
            minLongitude: -2.98,
            maxLongitude: -2.96,
          },
          minElevationM: 1,
          maxElevationM: 3,
          sha256: terrainAsset.sha256,
        },
      },
    };
    const stored = replaceWorkerAssetReferences(
      manifestWithAsset,
      new Map([["terrain.f32", `${courseId}/v4/terrain.f32`]]),
    );
    expect(stored.terrain.heightmap?.url).toBe(`storage://${courseId}/v4/terrain.f32`);
    const delivered = await resolveCourseTwinAssetReferences(
      stored,
      async (path) => `https://storage.test/signed/${path}`,
    );
    expect(delivered.terrain.heightmap?.url).toBe(
      `https://storage.test/signed/${courseId}/v4/terrain.f32`,
    );
  });
});
