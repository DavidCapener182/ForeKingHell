import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import aintree from "@/generated/course-twins/aintree-v1.json";

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
});
