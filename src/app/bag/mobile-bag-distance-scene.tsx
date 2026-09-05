"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, Html, RoundedBox } from "@react-three/drei";
import { advanceMobileSpring } from "@/lib/mobile-motion-spring";
import type { Group, Mesh } from "three";
import type { MobileBagDistanceView } from "@/lib/mobile-bag-distance-view";

export default function MobileBagDistanceScene({
  model,
  selected,
  onSelect,
  onUnavailable,
}: {
  model: MobileBagDistanceView;
  selected: string;
  onSelect: (id: string) => void;
  onUnavailable: () => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return (
    <Canvas
      orthographic
      camera={{ position: [72, 115, 105], zoom: 2 }}
      dpr={[1, 1.5]}
      frameloop={visible ? "demand" : "never"}
      gl={{ antialias: true, powerPreference: "low-power" }}
      fallback={<p>Use the 2D view if this browser cannot display 3D.</p>}
      aria-label="Interactive 3D carry distance comparison"
      onCreated={({ gl }) => {
        gl.setClearColor("#0b352a");
      }}
    >
      <SceneLifecycle onUnavailable={onUnavailable} />
      <ResponsiveCamera />
      <ambientLight intensity={0.9} />
      <directionalLight position={[20, 90, 20]} intensity={1.3} />
      <RoundedBox args={[78, 1.4, 116]} radius={0.6} smoothness={3} position={[0, -0.9, -50]}>
        <meshStandardMaterial color="#245f45" roughness={1} />
      </RoundedBox>
      {Array.from({ length: model.limit / 50 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, ((-(i + 1) * 50) / model.limit) * 100]}
        >
          <planeGeometry args={[74, 0.22]} />
          <meshBasicMaterial color="#70a38b" />
        </mesh>
      ))}
      {model.clubs.map((club) => (
        <AnimatedClubMarker
          key={club.id}
          club={club}
          active={club.id === selected}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls
        target={[0, 0, -48]}
        enablePan={false}
        enableDamping={false}
        minZoom={1.3}
        maxZoom={3.5}
        minPolarAngle={0.35}
        maxPolarAngle={1.1}
        minAzimuthAngle={-0.9}
        maxAzimuthAngle={0.9}
      />
    </Canvas>
  );
}
function SceneLifecycle({ onUnavailable }: { onUnavailable: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onUnavailable]);
  return null;
}

function ResponsiveCamera() {
  const size = useThree((state) => state.size);
  return (
    <OrthographicCamera
      makeDefault
      position={[72, 115, 105]}
      zoom={Math.min(size.width / 120, size.height / 125)}
      near={0.1}
      far={600}
    />
  );
}

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function AnimatedClubMarker({
  club,
  active,
  onSelect,
}: {
  club: MobileBagDistanceView["clubs"][number];
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const invalidate = useThree((state) => state.invalidate);
  const marker = useRef<Group>(null),
    stem = useRef<Mesh>(null),
    ball = useRef<Mesh>(null),
    line = useRef<Mesh>(null);
  const motion = useRef({
    reveal: { value: reduced ? 1 : 0, velocity: 0 },
    height: { value: 4, velocity: 0 },
  });
  useEffect(() => {
    invalidate();
  }, [active, reduced, invalidate]);
  useFrame((_, delta) => {
    const state = motion.current,
      target = active ? 8 : 4;
    state.reveal = advanceMobileSpring(state.reveal, 1, delta, reduced);
    state.height = advanceMobileSpring(state.height, target, delta, reduced);
    const settled = state.reveal.value === 1 && state.height.value === target;
    const distance = club.distance * state.reveal.value;
    if (marker.current) marker.current.position.z = -distance;
    if (stem.current) {
      stem.current.scale.y = state.height.value;
      stem.current.position.y = state.height.value / 2;
    }
    if (ball.current) {
      ball.current.position.y = state.height.value + 1;
      ball.current.scale.setScalar(1.5 + (state.height.value - 4) * 0.225);
    }
    if (line.current) {
      line.current.scale.y = distance;
      line.current.position.z = -distance / 2;
    }
    if (!settled) invalidate();
  });
  const color = active ? "#e5ff8d" : club.confidence >= 75 ? "#a4e5bd" : "#93b9ad";
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(club.id);
      }}
    >
      <mesh
        ref={line}
        position={[club.lane, 0.04, -club.distance / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1, reduced ? club.distance : 0, 1]}
      >
        <planeGeometry args={[active ? 1.2 : 0.5, 1]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.85 : 0.35} />
      </mesh>
      <group ref={marker} position={[club.lane, 0, reduced ? -club.distance : 0]}>
        <mesh ref={stem} position={[0, 2, 0]} scale={[1, 4, 1]}>
          <cylinderGeometry args={[0.4, 0.4, 1, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh ref={ball} position={[0, 5, 0]} scale={1.5}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
        {active ? (
          <Html
            position={[0, 16, 0]}
            center
            style={{
              pointerEvents: "none",
              whiteSpace: "nowrap",
              borderRadius: 8,
              padding: "5px 9px",
              background: "#f4fff6",
              color: "#123c2b",
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "0 2px 8px #00180b25",
            }}
          >
            {club.label} · {Math.round(club.carry)} yd
          </Html>
        ) : null}
      </group>
    </group>
  );
}
