"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";

import { CourseTwinFoliage } from "./course-twin-foliage";
import { CourseTwinShotPath } from "./course-twin-shot-path";
import { CourseTwinTerrain } from "./course-twin-terrain";
import { useCourseTwinTextures } from "./course-twin-textures";
import type { CourseTwinQuality, MarketingShotPlan } from "./course-twin-types";

export function CourseTwinScene({
  plan,
  replayToken,
  reducedMotion,
  quality,
  onUnavailable,
}: {
  plan: MarketingShotPlan;
  replayToken: number;
  reducedMotion: boolean;
  quality: CourseTwinQuality;
  onUnavailable: () => void;
}) {
  return (
    <>
      <color attach="background" args={["#c5ccb4"]} />
      <fog attach="fog" args={["#c5ccb4", 128, 205]} />
      <hemisphereLight args={["#f0f2df", "#54624a", 1.8]} />
      <directionalLight position={[-34, 55, 31]} color="#ffe5b5" intensity={2.4} />
      <directionalLight position={[38, 22, -48]} color="#a2c7bc" intensity={0.62} />
      <ambientLight intensity={0.34} />

      <PerspectiveCamera
        makeDefault
        fov={quality === "compact" ? 45 : 40}
        near={1}
        far={210}
        position={quality === "compact" ? [43, 68, 87] : [45, 65, 82]}
        onUpdate={(camera) => camera.lookAt(0, 0, -3.5)}
      />
      <WebGlContextGuard onUnavailable={onUnavailable} />

      <mesh position={[0, -1.8, 0]}>
        <boxGeometry args={[68, 3.2, 108]} />
        <meshStandardMaterial color="#263426" roughness={1} />
      </mesh>

      <Suspense fallback={<LoadingCourseSurface />}>
        <TexturedCourse
          quality={quality}
          plan={plan}
          replayToken={replayToken}
          reducedMotion={reducedMotion}
        />
      </Suspense>
    </>
  );
}

function TexturedCourse({
  quality,
  plan,
  replayToken,
  reducedMotion,
}: {
  quality: CourseTwinQuality;
  plan: MarketingShotPlan;
  replayToken: number;
  reducedMotion: boolean;
}) {
  const textures = useCourseTwinTextures(quality);
  return (
    <group>
      <CourseTwinTerrain quality={quality} textures={textures} />
      <CourseTwinFoliage quality={quality} />
      <CourseTwinShotPath plan={plan} replayToken={replayToken} reducedMotion={reducedMotion} />
    </group>
  );
}

function WebGlContextGuard({ onUnavailable }: { onUnavailable: () => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLoss = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    canvas.addEventListener("webglcontextlost", handleContextLoss, { passive: false });
    return () => canvas.removeEventListener("webglcontextlost", handleContextLoss);
  }, [gl, onUnavailable]);
  return null;
}

function LoadingCourseSurface() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
      <planeGeometry args={[66, 106, 8, 12]} />
      <meshStandardMaterial color="#587340" roughness={1} />
    </mesh>
  );
}
