"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useProgressiveCourseImagery } from "./course-twin-progressive-texture";

/** Real-world metre scale; the sewn hoist stays fixed while the free edge flutters. */
export function HoleFlag({ position }: { position: [number, number, number] }) {
  const gl = useThree((state) => state.gl);
  const logo = useProgressiveCourseImagery("/brand/lm-world-tour-logo.png", gl);
  const cloth = useRef<THREE.PlaneGeometry>(null);
  const print = useMemo(() => {
    if (!logo || !(logo.image instanceof HTMLImageElement)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 1024, 640);
    context.strokeStyle = "#c89b42";
    context.lineWidth = 12;
    context.strokeRect(26, 26, 972, 588);
    context.drawImage(logo.image, 240, 48, 544, 544);
    // A stitched hoist and hem remain visible without baking any directional light.
    context.strokeStyle = "#d8d8d0";
    context.lineWidth = 2;
    context.setLineDash([5, 5]);
    context.strokeRect(12, 12, 1000, 616);
    context.beginPath();
    context.moveTo(58, 12);
    context.lineTo(58, 628);
    context.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return texture;
  }, [logo, gl]);
  useEffect(() => () => print?.dispose(), [print]);

  useFrame(({ clock, scene }) => {
    if (!cloth.current) return;
    const time = scene.userData.freezeWind ? 0 : clock.elapsedTime;
    const vertices = cloth.current.attributes.position;
    const uv = cloth.current.attributes.uv;
    for (let i = 0; i < vertices.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      const wave = Math.sin(u * 8 - time * 2.1 + v * 1.2);
      vertices.setXYZ(
        i,
        u * 1.05,
        (v - 0.5) * 0.66 - 0.075 * u * u,
        u * (0.055 * wave + 0.025 * Math.sin(u * 15 - time * 3.2 + v * 2)),
      );
    }
    vertices.needsUpdate = true;
    cloth.current.computeVertexNormals();
  });

  return (
    <group position={position} name="LM World Tour flagstick">
      <mesh position={[0, 1.48, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.019, 2.96, 16]} />
        <meshStandardMaterial color="#eeeae0" roughness={0.32} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.0195, 0.0195, 0.86, 16]} />
        <meshStandardMaterial color="#142b30" roughness={0.4} metalness={0.25} />
      </mesh>
      <mesh position={[0, 2.99, 0]} castShadow>
        <sphereGeometry args={[0.031, 16, 12]} />
        <meshStandardMaterial color="#d1ac5e" metalness={0.75} roughness={0.3} />
      </mesh>
      <group rotation={[0, -0.34, 0]}>
        <mesh position={[0.018, 2.58, 0]} castShadow receiveShadow>
          <planeGeometry ref={cloth} args={[1.05, 0.66, 24, 12]} />
          <meshStandardMaterial
            map={print}
            color="#ffffff"
            side={THREE.DoubleSide}
            roughness={0.93}
            metalness={0}
          />
        </mesh>
        {[2.29, 2.87].map((height) => (
          <mesh key={height} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.024, 0.006, 6, 12]} />
            <meshStandardMaterial color="#bcbdb7" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.054, 32]} />
        <meshStandardMaterial color="#101b15" roughness={1} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.054, 0.061, 32]} />
        <meshStandardMaterial color="#d6d5c7" roughness={0.6} />
      </mesh>
    </group>
  );
}
