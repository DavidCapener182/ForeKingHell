"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraHelper, DirectionalLight, Object3D, Vector3 } from "three";
import type { OrbitControls } from "three-stdlib";
import { fitCourseShadow } from "@/lib/course-twin-shadow-fit";

export function CourseTwinSunlight({ high }: { high: boolean }) {
  const light = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const extent = useRef(160);
  const { scene } = useThree();
  const helper = useRef<CameraHelper | null>(null);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "development" ||
      !light.current ||
      new URLSearchParams(location.search).get("shadowDebug") !== "1"
    )
      return;
    const cameraHelper = new CameraHelper(light.current.shadow.camera);
    helper.current = cameraHelper;
    scene.add(cameraHelper);
    return () => {
      scene.remove(cameraHelper);
      cameraHelper.dispose();
      helper.current = null;
    };
  }, [scene]);
  useFrame(({ camera, controls }) => {
    const sun = light.current;
    if (!sun) return;
    const focus = (controls as OrbitControls | null)?.target ?? new Vector3();
    const distance = camera.position.distanceTo(focus);
    const wanted = Math.min(240, Math.max(80, Math.ceil((distance * 0.7) / 40) * 40));
    // Nested fixed sizes and a generous exit band avoid zoom-boundary oscillation.
    if (wanted > extent.current || wanted < extent.current - 40) extent.current = wanted;
    const half = extent.current;
    const fit = fitCourseShadow(focus, half, high ? 2048 : 1024);
    sun.position.copy(fit.position);
    target.position.copy(fit.centre);
    target.updateMatrixWorld();
    sun.updateMatrixWorld();
    const shadow = sun.shadow.camera;
    if (shadow.right !== half) {
      shadow.left = shadow.bottom = -half;
      shadow.right = shadow.top = half;
      shadow.near = 1;
      shadow.far = 1100;
      shadow.updateProjectionMatrix();
    }
    sun.shadow.updateMatrices(sun);
    helper.current?.update();
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        name="Course daylight sun"
        target={target}
        castShadow
        color="#fff8eb"
        intensity={1.8}
        shadow-mapSize-width={high ? 2048 : 1024}
        shadow-mapSize-height={high ? 2048 : 1024}
        shadow-bias={-0.00008}
        shadow-normalBias={0.12}
        shadow-radius={2}
      />
    </>
  );
}
