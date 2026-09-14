"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import assets from "@/generated/course-twins/context-assets.json";
import { courseTwinFeatureContains } from "@/lib/course-twin-surface";
import type { SceneryInstance } from "@/lib/course-twin-scenery";
import type {
  CourseTwinPoint,
  CourseTwinFeature,
  CourseTwinManifest,
} from "@/lib/course-twin-contract";

type Building = {
  id: string;
  ring: [number, number][];
  base: number;
  height: number;
  heightInferred?: boolean;
};
export type CourseContext = {
  courseId: string;
  origin: CourseTwinManifest["origin"];
  terrainSha256: string;
  features: CourseTwinFeature[];
  buildings: Building[];
  roads: { id: string; kind: string; width: number; points: CourseTwinPoint[] }[];
  parking: { id: string; ring: CourseTwinPoint[] }[];
  cars: SceneryInstance[];
};

export function useCourseTwinContext(manifest: CourseTwinManifest) {
  const [context, setContext] = useState<CourseContext | null>(null);
  const url = (assets as Record<string, string>)[manifest.course.id];
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("Course context unavailable");
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 4 * 1024 * 1024) throw Error("Course context exceeds budget");
        const data: CourseContext = JSON.parse(new TextDecoder().decode(bytes));
        if (
          data.courseId !== manifest.course.id ||
          data.origin.latitude !== manifest.origin.latitude ||
          data.origin.longitude !== manifest.origin.longitude ||
          data.terrainSha256 !== manifest.terrain.heightmap?.sha256 ||
          !Array.isArray(data.features) ||
          !Array.isArray(data.buildings)
        )
          throw Error("Course context mismatch");
        if (!controller.signal.aborted) setContext(data);
      })
      .catch(() => {
        /* Optional context must not prevent the packaged course loading. */
      });
    return () => controller.abort();
  }, [
    url,
    manifest.course.id,
    manifest.origin.latitude,
    manifest.origin.longitude,
    manifest.terrain.heightmap?.sha256,
  ]);
  const current = context?.courseId === manifest.course.id ? context : null;
  const displayManifest = useMemo(() => {
    if (!current) return manifest;
    const retained = manifest.features.filter((feature) => {
      const ring = feature.rings[0];
      if (!ring?.length) return true;
      const x = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
      const z = ring.reduce((sum, p) => sum + p[2], 0) / ring.length;
      return !current.features.some((f) => {
        if (f.type !== feature.type) return false;
        const points = f.rings[0];
        if (!points?.length) return false;
        const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
        const cz = points.reduce((sum, p) => sum + p[2], 0) / points.length;
        return (
          courseTwinFeatureContains(f, x, z) ||
          courseTwinFeatureContains(feature, cx, cz) ||
          (feature.type === "green" &&
            feature.source === "estimated_centerline" &&
            Math.hypot(cx - x, cz - z) < 30)
        );
      });
    });
    return { ...manifest, features: [...retained, ...current.features] };
  }, [current, manifest]);
  return { context: current, displayManifest };
}

/** Display-only extrusions from mapped footprints, never gameplay collision geometry. */
export function CourseTwinBuildings({ context }: { context: CourseContext | null }) {
  const geometry = useMemo(() => {
    if (!context) return null;
    const facadePositions: number[] = [];
    const facadeColours: number[] = [];
    let windowCount = 0;
    const parts = context.buildings.map((building) => {
      const shape = new THREE.Shape(building.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: building.height,
        bevelEnabled: false,
        steps: 1,
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, building.base - 0.1, 0);
      const colour = new Float32Array(geometry.attributes.position.count * 3);
      const seed = Array.from(building.id).reduce(
        (sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0,
        0,
      );
      const brick = new THREE.Color(
        ["#927a68", "#a18c78", "#89786a", "#a59480", "#967467"][seed % 5],
      );
      const roof = new THREE.Color(["#555b5b", "#4c5052", "#64574e"][seed % 3]);
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        const c = geometry.attributes.normal.getY(i) > 0.5 ? roof : brick;
        const contact =
          0.86 +
          0.14 *
            Math.min(1, Math.max(0, geometry.attributes.position.getY(i) - building.base) / 0.8);
        colour.set([c.r * contact, c.g * contact, c.b * contact], i * 3);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colour, 3));
      const ring = building.ring;
      const signedArea = ring.reduce((sum, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0);
      // Generic facade details are inferred; the mapped footprint remains unchanged.
      for (let edge = 0; edge < ring.length && windowCount < 20000; edge++) {
        const a = ring[edge],
          b = ring[(edge + 1) % ring.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 3) continue;
        const dx = (b[0] - a[0]) / length,
          dz = (b[1] - a[1]) / length;
        const nx = dz * Math.sign(signedArea),
          nz = -dx * Math.sign(signedArea);
        const columns = Math.min(16, Math.floor(length / 3)),
          floors = Math.min(6, Math.max(1, Math.floor(building.height / 3)));
        const quad = (
          along: number,
          y: number,
          width: number,
          height: number,
          colour: string,
          offset: number,
        ) => {
          const x = a[0] + dx * along + nx * offset,
            z = a[1] + dz * along + nz * offset;
          const left = [x - (dx * width) / 2, y, z - (dz * width) / 2],
            right = [x + (dx * width) / 2, y, z + (dz * width) / 2];
          const upperLeft = [left[0], y + height, left[2]],
            upperRight = [right[0], y + height, right[2]];
          const tint = new THREE.Color(colour);
          for (const point of [left, right, upperLeft, upperLeft, right, upperRight]) {
            facadePositions.push(...point);
            facadeColours.push(tint.r, tint.g, tint.b);
          }
        };
        for (let floor = 0; floor < floors; floor++)
          for (let column = 0; column < columns && windowCount < 20000; column++) {
            const along = ((column + 0.5) * length) / columns,
              y = building.base + 0.85 + floor * (building.height / floors);
            if (y + 1.45 > building.base + building.height - 0.25) continue;
            quad(along, y, 1.18, 1.45, "#a9a49a", 0.025);
            quad(
              along,
              y + 0.1,
              0.96,
              1.25,
              (seed + column + floor) % 4 === 0 ? "#596a70" : "#35474d",
              0.04,
            );
            quad(along, y + 0.1, 0.045, 1.25, "#a9a49a", 0.05);
            windowCount++;
          }
        if (edge === 0) quad(length * 0.5, building.base, 1.1, 2.1, "#414642", 0.06);
      }
      const area =
        Math.abs(
          ring.reduce((sum, p, i) => {
            const next = ring[(i + 1) % ring.length];
            return sum + p[0] * next[1] - next[0] * p[1];
          }, 0),
        ) / 2;
      // Modest inferred hip roofs on small footprints; larger structures stay flat.
      if (building.heightInferred && ring.length <= 6 && area > 15 && area < 220) {
        const cx = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
        const cz = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
        const y = building.base + building.height - 0.1;
        const points: number[] = [];
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length];
          points.push(
            a[0],
            y,
            a[1],
            b[0],
            y,
            b[1],
            cx,
            y + Math.min(2, Math.sqrt(area) * 0.15),
            cz,
          );
        }
        const top = new THREE.BufferGeometry();
        top.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
        top.computeVertexNormals();
        // OSM winding can vary; use the upward-facing order for roof lighting.
        if (top.attributes.normal.getY(0) < 0) {
          for (let i = 0; i < points.length; i += 9)
            for (let j = 0; j < 3; j++)
              [points[i + j], points[i + 3 + j]] = [points[i + 3 + j], points[i + j]];
          top.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
          top.computeVertexNormals();
        }
        top.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(new Float32Array((points.length / 3) * 2), 2),
        );
        const roofColours = new Float32Array(points.length);
        for (let i = 0; i < points.length; i += 3) roofColours.set([roof.r, roof.g, roof.b], i);
        top.setAttribute("color", new THREE.BufferAttribute(roofColours, 3));
        const combined = mergeGeometries([geometry, top]);
        if (combined) {
          geometry.dispose();
          top.dispose();
          return combined;
        }
        top.dispose();
      }
      return geometry;
    });
    if (facadePositions.length) {
      const facade = new THREE.BufferGeometry();
      facade.setAttribute("position", new THREE.Float32BufferAttribute(facadePositions, 3));
      facade.setAttribute("color", new THREE.Float32BufferAttribute(facadeColours, 3));
      facade.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(new Float32Array((facadePositions.length / 3) * 2), 2),
      );
      facade.computeVertexNormals();
      parts.push(facade);
    }
    const merged = parts.length ? mergeGeometries(parts) : null;
    parts.forEach((part) => part.dispose());
    return merged;
  }, [context]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry ? (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial vertexColors roughness={0.94} side={THREE.DoubleSide} />
    </mesh>
  ) : null;
}
