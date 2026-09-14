"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DirectionalLight } from "three";
import type { OrbitControls } from "three-stdlib";

/** Local visual QA only. Never changes source data, measurements or simulation. */
export function CourseTwinVisualProbe() {
  const get = useThree((state) => state.get);
  const frames = useRef<number[]>([]);
  const fixedDpr = useRef<number | null>(null);
  const pose = useRef<{ position: number[]; target: number[] } | null>(null);
  useFrame((state, delta) => {
    if (fixedDpr.current !== null && state.gl.getPixelRatio() !== fixedDpr.current)
      state.setDpr(fixedDpr.current);
    frames.current.push(delta * 1000);
    if (frames.current.length > 600) frames.current.shift();
    if (pose.current) {
      state.camera.position.fromArray(pose.current.position);
      const controls = state.controls as OrbitControls | null;
      if (controls) {
        controls.enabled = false;
        controls.target.fromArray(pose.current.target);
      }
      state.camera.lookAt(...(pose.current.target as [number, number, number]));
      state.camera.updateMatrixWorld();
    }
  });
  useEffect(() => {
    const state = get();
    const target = window as typeof window & { courseTwinVisualQa?: unknown };
    target.courseTwinVisualQa = {
      configure: ({ dpr }: { dpr: number }) => {
        state.scene.userData.freezeWind = true;
        fixedDpr.current = Math.min(2, Math.max(0.75, dpr));
      },
      resetFrames: () => {
        frames.current = [];
      },
      camera: (position: number[], lookAt: number[]) => {
        pose.current = { position, target: lookAt };
        frames.current = [];
      },
      landmarks: () => {
        const data = state.scene.getObjectByName("Course landscape")?.userData;
        return data?.holes?.map((h: { holeNumber: number; tee: number[]; green: number[] }) => ({
          hole: h.holeNumber,
          tee: [h.tee[0], data.sampleTerrain(h.tee[0], h.tee[2]), h.tee[2]],
          green: [h.green[0], data.sampleTerrain(h.green[0], h.green[2]), h.green[2]],
        }));
      },
      reset: () => {
        frames.current = [];
        performance.clearResourceTimings();
      },
      release: () => {
        pose.current = null;
        state.scene.userData.freezeWind = false;
        const controls = state.controls as OrbitControls | null;
        if (controls) controls.enabled = true;
      },
      read: () => {
        const sorted = [...frames.current].sort((a, b) => a - b);
        const sunlight: unknown[] = [];
        const lod: unknown[] = [];
        let objects = 0;
        state.scene.traverse((o) => {
          if (o instanceof DirectionalLight && o.castShadow)
            sunlight.push({
              position: o.position.toArray(),
              target: o.target.position.toArray(),
              bounds: [
                o.shadow.camera.left,
                o.shadow.camera.right,
                o.shadow.camera.bottom,
                o.shadow.camera.top,
              ],
              near: o.shadow.camera.near,
              far: o.shadow.camera.far,
            });
          if (o.userData.lod) lod.push(o.userData.lod);
        });
        state.scene.traverse(() => objects++);
        return {
          sunlight,
          lod,
          dpr: state.gl.getPixelRatio(),
          viewport: [state.size.width, state.size.height],
          calls: state.gl.info.render.calls,
          triangles: state.gl.info.render.triangles,
          geometries: state.gl.info.memory.geometries,
          textures: state.gl.info.memory.textures,
          objects,
          frames: sorted.length,
          medianFrameMs: sorted[Math.floor(sorted.length / 2)],
          p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
          p99FrameMs: sorted[Math.floor(sorted.length * 0.99)],
          maxFrameMs: sorted.at(-1),
          assetBytes: performance
            .getEntriesByType("resource")
            .filter((r) => r.name.includes("/course-twins/"))
            .reduce((n, r) => n + (r as PerformanceResourceTiming).encodedBodySize, 0),
          position: state.camera.position.toArray(),
          target: (state.controls as OrbitControls | null)?.target.toArray(),
          renderer: state.gl.getContext().getParameter(state.gl.getContext().RENDERER),
        };
      },
    };
    return () => {
      delete target.courseTwinVisualQa;
    };
  }, [get]);
  return null;
}
