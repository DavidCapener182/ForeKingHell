import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { courseTwinFeatureContains } from "./course-twin-surface";
import registry from "@/generated/course-twins/context-assets.json";

describe("course-specific optional scenery catalogue", () => {
  it("provides correctly anchored context for every active local course package", () => {
    for (const file of readdirSync("src/generated/course-twins").filter((f) =>
      f.endsWith(".json"),
    )) {
      const manifest = JSON.parse(readFileSync(`src/generated/course-twins/${file}`, "utf8"));
      if (!manifest.course?.id || !manifest.terrain?.heightmap) continue;
      const url = (registry as Record<string, string>)[manifest.course.id];
      expect(url, file).toMatch(/^\/course-twins\/common\/context-v1\/[a-z0-9-]+\.json$/);
      const bytes = readFileSync(`public${url}`);
      expect(bytes.length, file).toBeLessThan(4 * 1024 * 1024);
      const context = JSON.parse(bytes.toString());
      expect(context.courseId, file).toBe(manifest.course.id);
      expect(context.origin, file).toEqual(manifest.origin);
      expect(context.terrainSha256, file).toBe(manifest.terrain.heightmap.sha256);
      expect(context.license).toBe("ODbL-1.0");
      expect(context.decorativeOnly).toBe(true);
      expect(context.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      for (const feature of context.features) {
        expect(["green", "bunker", "tee", "fairway", "rough"]).toContain(feature.type);
        expect(feature.rings[0].length).toBeGreaterThanOrEqual(4);
        expect(feature.rings.flat(2).every(Number.isFinite)).toBe(true);
      }
      for (const road of context.roads) {
        expect(road.points.length).toBeGreaterThanOrEqual(2);
        expect(road.width).toBeGreaterThanOrEqual(0.6);
        expect(road.width).toBeLessThanOrEqual(20);
        expect(road.points.flat().every(Number.isFinite)).toBe(true);
      }
      expect(context.cars.length).toBeLessThanOrEqual(160);
      for (const car of context.cars) {
        const c = Math.cos(car.rotation),
          s = Math.sin(car.rotation);
        expect(
          context.parking.some((area: { ring: [number, number, number][] }) => {
            const f = {
              id: "parking",
              type: "rough" as const,
              holeNumber: null,
              source: "osm",
              rings: [area.ring],
            };
            return [
              [-1.4, -2.5],
              [1.4, -2.5],
              [-1.4, 2.5],
              [1.4, 2.5],
            ].every(([dx, dz]) =>
              courseTwinFeatureContains(f, car.x + dx * c + dz * s, car.z - dx * s + dz * c),
            );
          }),
        ).toBe(true);
      }
      for (const building of context.buildings) {
        expect(building.height).toBeGreaterThanOrEqual(2);
        expect(building.height).toBeLessThanOrEqual(60);
        expect(Number.isFinite(building.base)).toBe(true);
      }
    }
  });
});
