"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";

/** Local visual QA only. Never changes source data, measurements or simulation. */
export function CourseTwinVisualProbe() {
  const state = useThree();
  const frames = useRef<number[]>([]);
  const pose = useRef<{ position: number[]; target: number[] } | null>(null);
  useFrame((_, delta) => {
    frames.current.push(delta * 1000);
    if (frames.current.length > 180) frames.current.shift();
    if (pose.current) {
      state.camera.position.fromArray(pose.current.position);
      const controls = state.controls as OrbitControls | null;
      controls?.target.fromArray(pose.current.target);
      state.camera.lookAt(...(pose.current.target as [number, number, number]));
      controls?.update();
    }
  });
  useEffect(() => {
    const target = window as typeof window & { courseTwinVisualQa?: unknown };
    target.courseTwinVisualQa = {
      camera: (position: number[], lookAt: number[]) => {
        pose.current = { position, target: lookAt };
        frames.current = [];
      },
      release: () => {
        pose.current = null;
      },
      read: () => {
        const sorted = [...frames.current].sort((a, b) => a - b);
        let objects = 0;
        state.scene.traverse(() => objects++);
        return {
          calls: state.gl.info.render.calls,
          triangles: state.gl.info.render.triangles,
          geometries: state.gl.info.memory.geometries,
          textures: state.gl.info.memory.textures,
          objects,
          frames: sorted.length,
          medianFrameMs: sorted[Math.floor(sorted.length / 2)],
          p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
          position: state.camera.position.toArray(),
          target: (state.controls as OrbitControls | null)?.target.toArray(),
          renderer: state.gl.getContext().getParameter(state.gl.getContext().RENDERER),
        };
      },
    };
    return () => {
      delete target.courseTwinVisualQa;
    };
  }, [state]);
  return null;
}
