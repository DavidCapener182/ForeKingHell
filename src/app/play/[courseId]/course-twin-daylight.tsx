"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator, type WebGLRenderTarget } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/** Lighting only: this is not an aerial reference or a surveyed local sky. */
export function CourseTwinDaylight({ enabled }: { enabled: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (!enabled || new URLSearchParams(window.location.search).get("scenery") === "off") return;
    let cancelled = false;
    let target: WebGLRenderTarget | null = null;
    const previous = scene.environment;
    const intensity = scene.environmentIntensity;
    const timer = setTimeout(() => {
      new HDRLoader().load(
        "/course-twins/common/blender-v1/daylight.hdr",
        (texture) => {
          if (cancelled) {
            texture.dispose();
            return;
          }
          const generator = new PMREMGenerator(gl);
          target = generator.fromEquirectangular(texture);
          texture.dispose();
          generator.dispose();
          scene.environment = target.texture;
          scene.environmentIntensity = 0.22;
        },
        undefined,
        () => {
          /* Existing daylight remains the fallback. */
        },
      );
    }, 1800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (target && scene.environment === target.texture) {
        scene.environment = previous;
        scene.environmentIntensity = intensity;
      }
      target?.dispose();
    };
  }, [enabled, gl, scene]);
  return null;
}
