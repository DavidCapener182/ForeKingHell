"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { terrainHeight } from "./course-twin-data";
import type { MarketingShotPlan } from "./course-twin-types";

const routeVertexShader = `
  varying float vRouteProgress;
  void main() {
    vRouteProgress = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const routeFragmentShader = `
  uniform float uProgress;
  uniform vec3 uColour;
  varying float vRouteProgress;
  void main() {
    if (vRouteProgress > uProgress) discard;
    float headGlow = smoothstep(0.14, 0.0, abs(vRouteProgress - uProgress));
    gl_FragColor = vec4(mix(uColour, vec3(1.0, 0.965, 0.76), headGlow * 0.5), 0.96);
  }
`;

function createTrajectory(plan: MarketingShotPlan) {
  const groundCurve = new THREE.CatmullRomCurve3(
    plan.controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal",
    0.44,
  );
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 96; index += 1) {
    const progress = index / 96;
    const horizontal = groundCurve.getPointAt(progress);
    const ground = terrainHeight(horizontal.x, horizontal.z) + 0.24;
    const arc = Math.sin(progress * Math.PI) ** 0.92 * plan.apexMetres;
    points.push(new THREE.Vector3(horizontal.x, ground + arc, horizontal.z));
  }
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.35);
}

export function CourseTwinShotPath({
  plan,
  replayToken,
  reducedMotion,
}: {
  plan: MarketingShotPlan;
  replayToken: number;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const trajectory = useMemo(() => createTrajectory(plan), [plan]);
  const routeGeometry = useMemo(
    () => new THREE.TubeGeometry(trajectory, 96, 0.105, 6, false),
    [trajectory],
  );
  const routeUnderlay = useMemo(
    () => new THREE.TubeGeometry(trajectory, 96, 0.18, 6, false),
    [trajectory],
  );
  const routeUniforms = useMemo(
    () => ({
      uProgress: { value: reducedMotion ? 1 : 0 },
      uColour: { value: new THREE.Color(plan.club === "driver" ? "#f3c75f" : "#f8db84") },
    }),
    [plan.club, reducedMotion],
  );
  const startTime = useRef(0);
  const routeMaterial = useRef<THREE.ShaderMaterial>(null);
  const shotMarker = useRef<THREE.Mesh>(null);
  const landingPulse = useRef<THREE.Mesh>(null);
  const landingPulseMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const dispersionMaterial = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    startTime.current = performance.now();
    if (routeMaterial.current) {
      routeMaterial.current.uniforms.uProgress.value = reducedMotion ? 1 : 0;
    }
    if (shotMarker.current) shotMarker.current.visible = !reducedMotion;
    if (landingPulse.current) landingPulse.current.scale.setScalar(reducedMotion ? 1.35 : 0.35);
    if (landingPulseMaterial.current)
      landingPulseMaterial.current.opacity = reducedMotion ? 0.45 : 0;
    if (dispersionMaterial.current) dispersionMaterial.current.opacity = reducedMotion ? 0.2 : 0.04;
    invalidate();
  }, [invalidate, plan.club, replayToken, reducedMotion]);

  useEffect(
    () => () => {
      routeGeometry.dispose();
      routeUnderlay.dispose();
    },
    [routeGeometry, routeUnderlay],
  );

  useFrame(() => {
    if (reducedMotion) return;
    const elapsed = performance.now() - startTime.current;
    const travel = THREE.MathUtils.clamp(elapsed / 1_340, 0, 1);
    const easedTravel = 1 - (1 - travel) ** 3;
    if (routeMaterial.current) routeMaterial.current.uniforms.uProgress.value = easedTravel;
    if (shotMarker.current) {
      shotMarker.current.position.copy(trajectory.getPointAt(easedTravel));
      shotMarker.current.visible = travel < 0.997;
    }

    const landingProgress = THREE.MathUtils.clamp((elapsed - 1_020) / 660, 0, 1);
    if (landingPulse.current) {
      const pulseScale = 0.35 + landingProgress * 1.7;
      landingPulse.current.scale.setScalar(pulseScale);
    }
    if (landingPulseMaterial.current) {
      landingPulseMaterial.current.opacity = Math.sin(landingProgress * Math.PI) * 0.72;
    }
    if (dispersionMaterial.current) {
      dispersionMaterial.current.opacity = 0.04 + landingProgress * 0.16;
    }

    if (elapsed < 1_720) invalidate();
  });

  const landingHeight = terrainHeight(...plan.landing) + 0.16;
  const missHeight = terrainHeight(...plan.miss.centre) + 0.14;

  return (
    <group>
      <mesh geometry={routeUnderlay}>
        <meshBasicMaterial color="#153325" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh geometry={routeGeometry}>
        <shaderMaterial
          ref={routeMaterial}
          vertexShader={routeVertexShader}
          fragmentShader={routeFragmentShader}
          uniforms={routeUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={shotMarker}>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshBasicMaterial color="#fff7d6" toneMapped={false} />
      </mesh>

      <group position={[plan.landing[0], landingHeight, plan.landing[1]]}>
        <mesh
          rotation={[-Math.PI / 2, 0, plan.dispersion.rotation]}
          scale={[plan.dispersion.radiusX, plan.dispersion.radiusZ, 1]}
        >
          <circleGeometry args={[1, 64]} />
          <meshBasicMaterial
            ref={dispersionMaterial}
            color="#f5d77e"
            transparent
            opacity={0.04}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, plan.dispersion.rotation]}
          scale={[plan.dispersion.radiusX, plan.dispersion.radiusZ, 1]}
        >
          <ringGeometry args={[0.92, 1, 64]} />
          <meshBasicMaterial
            color="#f6dc8d"
            transparent
            opacity={0.64}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh ref={landingPulse} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.48, 0.68, 40]} />
          <meshBasicMaterial
            ref={landingPulseMaterial}
            color="#fff3bd"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <SafeTargetMarker />
      </group>

      <group position={[plan.miss.centre[0], missHeight, plan.miss.centre[1]]}>
        <mesh
          rotation={[-Math.PI / 2, 0, plan.miss.rotation]}
          scale={[plan.miss.radiusX, plan.miss.radiusZ, 1]}
        >
          <ringGeometry args={[0.8, 1, 54]} />
          <meshBasicMaterial
            color="#c96f55"
            transparent
            opacity={0.62}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <CommonMissMarker />
      </group>
    </group>
  );
}

function SafeTargetMarker() {
  return (
    <group position={[0, 0.15, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.78, 36]} />
        <meshBasicMaterial color="#f8f0c7" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.1, 0.04, 1.8]} />
        <meshBasicMaterial color="#f8f0c7" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.1, 0.04, 1.8]} />
        <meshBasicMaterial color="#f8f0c7" toneMapped={false} />
      </mesh>
    </group>
  );
}

function CommonMissMarker() {
  return (
    <group position={[0, 0.18, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh>
        <boxGeometry args={[0.15, 0.05, 1.45]} />
        <meshBasicMaterial color="#f0b08b" toneMapped={false} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.15, 0.05, 1.45]} />
        <meshBasicMaterial color="#f0b08b" toneMapped={false} />
      </mesh>
    </group>
  );
}
