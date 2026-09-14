import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { fitCourseShadow, COURSE_SUN_DIRECTION } from "./course-twin-shadow-fit";
import { partitionScenery, type SceneryInstance } from "./course-twin-scenery";
const tree = (x: number, height: number): SceneryInstance => ({
  x,
  y: 0,
  z: 0,
  height,
  widthScale: 1,
  rotation: 0,
  variant: 0,
  tint: 0,
});
describe("course daylight coverage", () => {
  it("keeps the target local and preserves sun direction across distant courses", () => {
    for (const point of [new Vector3(-420, 30, 700), new Vector3(880, -2, -960)]) {
      const fit = fitCourseShadow(point, 160, 2048);
      expect(fit.centre.distanceTo(point)).toBeLessThan(fit.texel);
      expect(
        fit.position.clone().sub(fit.centre).normalize().distanceTo(COURSE_SUN_DIRECTION),
      ).toBeLessThan(1e-9);
      expect(fit.position.distanceTo(fit.centre)).toBeCloseTo(550);
    }
  });
  it("does not slide light-space texels for a sub-texel pan", () => {
    const start = fitCourseShadow(new Vector3(), 160, 2048);
    const right = new Vector3()
      .crossVectors(new Vector3(0, 1, 0), COURSE_SUN_DIRECTION)
      .normalize();
    const end = fitCourseShadow(right.multiplyScalar(start.texel * 0.2), 160, 2048);
    expect(end.centre.distanceTo(start.centre)).toBeLessThan(1e-9);
  });
});
describe("projected vegetation importance", () => {
  it("retains a prominent aerial tree beyond the old 170 metre cutoff", () => {
    const p = partitionScenery([tree(180, 18), tree(80, 1)], { x: 0, y: 100, z: 0 }, true, false, {
      focalPixels: 900,
    });
    expect(p.mid).toEqual([0]);
    expect(p.far).toEqual([1]);
  });
  it("uses hysteresis and excludes offscreen instances from the model budget", () => {
    const points = [tree(100, 2), tree(100, 20)];
    const p = partitionScenery(points, { x: 0, y: 0, z: 0 }, true, false, {
      focalPixels: 900,
      previous: { near: [], mid: [0] },
      visible: (p) => p.height < 10,
    });
    expect(p.mid).toEqual([0]);
    expect(p.far).toEqual([1]);
  });
  it("keeps a bounded deterministic partition under crowding", () => {
    const points = Array.from({ length: 500 }, (_, i) => tree(i + 1, 20));
    const p = partitionScenery(points, { x: 0, y: 30, z: 0 }, true, false, { focalPixels: 900 });
    expect(p.near.length).toBeLessThanOrEqual(10);
    expect(p.mid.length).toBeLessThanOrEqual(20);
    expect(new Set([...p.near, ...p.mid, ...p.far]).size).toBe(500);
  });
});

// These ponds were present in the source extract but excluded by the old golf-tag-only import.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { courseTwinFeatureContains } from "./course-twin-surface";
import type { CourseTwinFeature } from "./course-twin-contract";
it("retains Bootle's mapped ponds across the fifth and fourteenth approaches", () => {
  const context = JSON.parse(
    readFileSync("public/course-twins/common/context-v1/bootle-golf-course-v1.json", "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync("src/generated/course-twins/bootle-golf-course-v1.json", "utf8"),
  );
  for (const [holeNumber, id] of [
    [5, "context-osm-way-1503034378"],
    [14, "context-osm-way-1503123505"],
  ] as const) {
    const pond: CourseTwinFeature = context.features.find((f: CourseTwinFeature) => f.id === id);
    expect(pond?.type).toBe("water");
    expect(pond?.source).toBe("openstreetmap_context");
    const hole = manifest.holes.find((h: { holeNumber: number }) => h.holeNumber === holeNumber);
    expect(
      Array.from({ length: 41 }, (_, i) => i / 40).some((t) =>
        courseTwinFeatureContains(
          pond,
          hole.tee[0] + (hole.green[0] - hole.tee[0]) * t,
          hole.tee[2] + (hole.green[2] - hole.tee[2]) * t,
        ),
      ),
    ).toBe(true);
  }
});
it("links the albedo impostors and linear AO bake to reproducible source hashes", () => {
  const root = "public/course-twins/common/blender-v1/";
  const impostors = JSON.parse(readFileSync(root + "impostors.json", "utf8"));
  const ao = JSON.parse(readFileSync(root + "rough-ao.json", "utf8"));
  for (const asset of [...impostors.assets, ao]) {
    const bytes = readFileSync(root + asset.file);
    expect(bytes.length).toBe(asset.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    expect(bytes.readUInt32BE(16)).toBe(512);
    expect(bytes.readUInt32BE(20)).toBe(512);
    expect(asset.licence).toBe("CC0-1.0");
    if (asset.source)
      expect(
        createHash("sha256")
          .update(readFileSync(root + asset.source))
          .digest("hex"),
      ).toBe(asset.sourceSha256);
  }
});
