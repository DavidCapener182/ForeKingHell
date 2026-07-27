import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import aintree from "@/generated/course-twins/aintree-v1.json";
import { localCourseTwinManifestsByCourseId } from "@/generated/course-twins/local-catalogue";

describe("checked-in Course Twin pilot packages", () => {
  it("ships Aintree as a real nine-hole LiDAR and aerial package", () => {
    expect(aintree.course).toMatchObject({
      id: "4de11156-16fd-4a36-84e0-fadda53456b0",
      name: "Aintree Golf Centre",
    });
    expect(aintree.quality).toMatchObject({
      grade: "B",
      mappedHoles: 9,
      expectedHoles: 9,
      verified: false,
    });
    expect(aintree.terrain).toMatchObject({ kind: "lidar_dtm" });
    expect(aintree.terrain.resolutionM).toBeLessThanOrEqual(5);
    expect(aintree.holes).toHaveLength(9);
    expect(aintree.features.length).toBeGreaterThanOrEqual(70);

    const terrainPath = resolve("public", aintree.terrain.heightmap.url.replace(/^\//, ""));
    const imageryPath = resolve("public", aintree.terrain.imagery.url.replace(/^\//, ""));
    const terrain = readFileSync(terrainPath);
    const imagery = readFileSync(imageryPath);
    expect(terrain.byteLength).toBe(
      aintree.terrain.heightmap.width *
        aintree.terrain.heightmap.height *
        Float32Array.BYTES_PER_ELEMENT,
    );
    expect(createHash("sha256").update(terrain).digest("hex")).toBe(
      aintree.terrain.heightmap.sha256,
    );
    expect(imagery.byteLength).toBeGreaterThan(100_000);
  });

  it("ships and verifies the complete 20-to-50-course production pilot catalogue", () => {
    const report = JSON.parse(
      readFileSync(
        resolve("tools/course-twin-builder/catalog/uk-first-wave-packages.json"),
        "utf8",
      ),
    ) as {
      requested: number;
      completed: number;
      failed: number;
      packageGenerationComplete: boolean;
      manualVisualQaComplete: boolean;
      visualQa: {
        complete: boolean;
        approved: number;
        approvedWithCaveats: number;
        missing: string[];
        rejected: string[];
      };
      packages: Array<{
        courseId: string;
        slug: string;
        qualityGrade: string;
        mappedHoles: number;
        assets: Array<{ fileName: string; byteLength: number; sha256: string }>;
      }>;
    };
    expect(report.requested).toBeGreaterThanOrEqual(20);
    expect(report.requested).toBeLessThanOrEqual(50);
    expect(report).toMatchObject({
      completed: report.requested,
      failed: 0,
      packageGenerationComplete: true,
      manualVisualQaComplete: true,
      visualQa: {
        complete: true,
        approved: report.requested,
        approvedWithCaveats: report.requested,
        missing: [],
        rejected: [],
      },
    });
    expect(Object.keys(localCourseTwinManifestsByCourseId)).toHaveLength(report.completed);

    for (const entry of report.packages) {
      const manifest = localCourseTwinManifestsByCourseId[entry.courseId] as typeof aintree;
      expect(manifest.course.id).toBe(entry.courseId);
      expect(manifest.quality.grade).toBe(entry.qualityGrade);
      expect(manifest.holes).toHaveLength(entry.mappedHoles);
      expect(manifest.terrain.heightmap).toMatchObject({ width: 513, height: 513 });
      for (const asset of entry.assets) {
        const bytes = readFileSync(resolve("public/course-twins", entry.slug, asset.fileName));
        expect(bytes.byteLength).toBe(asset.byteLength);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      }
    }
  });
});
