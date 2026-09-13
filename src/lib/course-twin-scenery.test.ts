import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { partitionScenery, sceneryClearOfPlay, type SceneryInstance } from "./course-twin-scenery";
import { buildTreeInstances, buildBushInstances } from "./course-twin-vegetation-placement";
import { createCourseTwinTerrainSampler, decodeCourseTwinHeightmap } from "./course-twin-terrain";
import type { CourseTwinManifest } from "./course-twin-contract";

describe("Blender scenery uses authoritative course placement", () => {
  for (const course of ["arscott-v1", "arrowe-park-v1"])
    it(`${course}: stable, grounded and clear of mapped playing surfaces`, () => {
      const manifest: CourseTwinManifest = JSON.parse(
        readFileSync(`src/generated/course-twins/${course}.json`, "utf8"),
      );
      const hm = manifest.terrain.heightmap!;
      const bytes = readFileSync(`public${hm.url}`);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const sample = createCourseTwinTerrainSampler(hm, decodeCourseTwinHeightmap(buffer, hm));
      const args = [manifest.features, manifest.holes, hm.localBounds, sample] as const;
      for (const build of [buildTreeInstances, buildBushInstances]) {
        const first = build(...args).filter((p) => sceneryClearOfPlay(p, manifest.features));
        expect(first).toEqual(
          build(...args).filter((p) => sceneryClearOfPlay(p, manifest.features)),
        );
        expect(first.length).toBeGreaterThan(0);
        for (const p of first) {
          expect(p.y).toBe(sample(p.x, p.z));
          expect(sceneryClearOfPlay(p, manifest.features)).toBe(true);
        }
      }
    });
  it("partitions instances once, with bounded near and mid counts", () => {
    const points = Array.from(
      { length: 500 },
      (_, i) =>
        ({
          x: i,
          y: 0,
          z: 0,
          height: 10,
          widthScale: 1,
          rotation: 0,
          variant: 0,
          tint: 0,
        }) satisfies SceneryInstance,
    );
    for (const high of [true, false]) {
      const partition = partitionScenery(points, { x: 0, y: 0, z: 0 }, high);
      expect(partition.near.length).toBeLessThanOrEqual(high ? 10 : 4);
      expect(partition.mid.length).toBeLessThanOrEqual(high ? 20 : 8);
      expect(new Set([...partition.near, ...partition.mid, ...partition.far]).size).toBe(
        points.length,
      );
      expect(partitionScenery(points, { x: 0, y: 1000, z: 0 }, high).far.length).toBe(
        points.length,
      );
    }
  });
  it("exports valid local GLBs with a one-metre Y-up height and no external dependencies", () => {
    const ledger = JSON.parse(
      readFileSync("public/course-twins/common/blender-v1/exports.json", "utf8"),
    );
    for (const entry of ledger.exports) {
      const bytes = readFileSync(`public/course-twins/common/blender-v1/${entry.file}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      expect(gltf.asset.version).toBe("2.0");
      expect(gltf.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
      expect(gltf.images.every((b: { uri?: string }) => !b.uri)).toBe(true);
      const positions = gltf.meshes.flatMap(
        (m: { primitives: { attributes: { POSITION: number } }[] }) =>
          m.primitives.map((p) => gltf.accessors[p.attributes.POSITION]),
      );
      expect(Math.min(...positions.map((p: { min: number[] }) => p.min[1]))).toBeCloseTo(0, 2);
      expect(Math.max(...positions.map((p: { max: number[] }) => p.max[1]))).toBeCloseTo(1, 2);
      expect(gltf.extensionsRequired ?? []).not.toContain("KHR_draco_mesh_compression");
    }
  });
});
