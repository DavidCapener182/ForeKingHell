"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CourseTwinPoint } from "@/lib/course-twin-contract";
import type { CourseTwinTerrainSampler } from "@/lib/course-twin-terrain";
import type { CourseContext } from "./course-twin-buildings";
import { BlenderVegetation } from "./course-twin-blender-vegetation";

export function CourseTwinRoads({
  context,
  sampleTerrain,
  high,
}: {
  context: CourseContext | null;
  sampleTerrain: CourseTwinTerrainSampler;
  high: boolean;
}) {
  const cars = useMemo(
    () => (context?.cars ?? []).map((car) => ({ ...car, y: sampleTerrain(car.x, car.z) + 0.08 })),
    [context, sampleTerrain],
  );
  const geometry = useMemo(() => {
    if (!context) return null;
    const parts: THREE.BufferGeometry[] = [];
    const strip = (points: CourseTwinPoint[], width: number, hex: string, raise: number) => {
      const positions: number[] = [];
      const colours: number[] = [];
      const colour = new THREE.Color(hex);
      const path: [number, number][] = [];
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1],
          b = points[j];
        const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (length < 0.01) continue;
        const steps = Math.ceil(length / 1.5);
        for (let i = 0; i < steps; i++)
          path.push([a[0] + ((b[0] - a[0]) * i) / steps, a[2] + ((b[2] - a[2]) * i) / steps]);
      }
      if (!path.length) return;
      path.push([points.at(-1)![0], points.at(-1)![2]]);
      const edges = path.map(([x, z], i) => {
        const previous = path[Math.max(0, i - 1)],
          next = path[Math.min(path.length - 1, i + 1)];
        const dx = next[0] - previous[0],
          dz = next[1] - previous[1],
          length = Math.hypot(dx, dz) || 1;
        return [
          [x - ((dz / length) * width) / 2, z + ((dx / length) * width) / 2],
          [x + ((dz / length) * width) / 2, z - ((dx / length) * width) / 2],
        ];
      });
      for (let i = 1; i < edges.length; i++) {
        const [a, b] = edges[i - 1],
          [c, d] = edges[i];
        const across = Math.max(1, Math.ceil(width / 1.25));
        const between = (start: number[], end: number[], t: number) => [
          start[0] + (end[0] - start[0]) * t,
          start[1] + (end[1] - start[1]) * t,
        ];
        for (let lane = 0; lane < across; lane++) {
          const aa = between(a, b, lane / across),
            bb = between(a, b, (lane + 1) / across);
          const cc = between(c, d, lane / across),
            dd = between(c, d, (lane + 1) / across);
          for (const [px, pz] of [aa, cc, bb, bb, cc, dd]) {
            positions.push(px, sampleTerrain(px, pz) + raise, pz);
            colours.push(colour.r, colour.g, colour.b);
          }
        }
      }
      if (!positions.length) return;
      const part = new THREE.BufferGeometry();
      part.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      part.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
      part.computeVertexNormals();
      parts.push(part);
    };
    for (const area of context.parking ?? []) {
      const shape = new THREE.Shape(area.ring.map((p) => new THREE.Vector2(p[0], -p[2])));
      const source = new THREE.ShapeGeometry(shape);
      const part = new TessellateModifier(2, 10).modify(source);
      source.dispose();
      part.rotateX(-Math.PI / 2);
      const pos = part.attributes.position;
      const col = new THREE.Color("#60625d");
      const colours = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, sampleTerrain(pos.getX(i), pos.getZ(i)) + 0.045);
        colours.set([col.r, col.g, col.b], i * 3);
      }
      part.deleteAttribute("uv");
      part.setAttribute("color", new THREE.BufferAttribute(colours, 3));
      part.computeVertexNormals();
      parts.push(part);
    }
    for (const road of context.roads ?? []) {
      const path = ["footway", "path", "track", "cycleway", "pedestrian"].includes(road.kind);
      strip(
        road.points,
        road.width + (path ? 0.25 : 0.7),
        path ? "#7e795e" : "#909087",
        path ? 0.04 : 0.1,
      );
      strip(road.points, road.width, path ? "#a29b81" : "#555b5c", path ? 0.065 : 0.14);
    }
    for (const car of context.cars ?? []) {
      const c = Math.cos(car.rotation),
        s = Math.sin(car.rotation);
      for (const side of [-1, 1]) {
        const x = car.x + side * 1.4 * c,
          z = car.z - side * 1.4 * s;
        strip(
          [
            [x - 2.5 * s, 0, z - 2.5 * c],
            [x + 2.5 * s, 0, z + 2.5 * c],
          ],
          0.075,
          "#d4d1b9",
          0.07,
        );
      }
    }
    const merged = parts.length ? mergeGeometries(parts) : null;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [context, sampleTerrain]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return (
    <group name="Mapped roads and inferred parked cars" userData={{ decorativeOnly: true }}>
      {geometry ? (
        <mesh geometry={geometry} receiveShadow>
          <meshStandardMaterial
            vertexColors
            roughness={0.96}
            side={THREE.DoubleSide}
            onBeforeCompile={(shader) => {
              shader.vertexShader =
                "varying vec3 vPavementPosition;\n" +
                shader.vertexShader.replace(
                  "#include <begin_vertex>",
                  "#include <begin_vertex>\nvPavementPosition = position;",
                );
              shader.fragmentShader =
                "varying vec3 vPavementPosition;\n" +
                shader.fragmentShader.replace(
                  "#include <color_fragment>",
                  `#include <color_fragment>
        float pavementGrain=fract(sin(dot(floor(vPavementPosition.xz*12.0),vec2(12.9898,78.233)))*43758.5453);
        float pavementDistance=1.0-smoothstep(25.0,100.0,length(vViewPosition));
        float pavementWear = sin(vPavementPosition.x*0.18 + sin(vPavementPosition.z*0.11))*sin(vPavementPosition.z*0.23);
        diffuseColor.rgb *= 1.0+(pavementGrain-0.5)*0.10*pavementDistance + pavementWear*0.025;
      `,
                );
            }}
            customProgramCacheKey={() => "course-pavement-grain-v2"}
          />
        </mesh>
      ) : null}
      {context?.cars?.length ? (
        <BlenderVegetation
          key={`cars-${context.courseId}-${high}`}
          asset="parked_car"
          instances={cars}
          high={high}
          fallback={() => null}
        />
      ) : null}
    </group>
  );
}
