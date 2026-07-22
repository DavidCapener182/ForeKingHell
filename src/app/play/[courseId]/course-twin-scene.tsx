"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ChevronLeft, ChevronRight, CirclePause, CirclePlay, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  CourseTwinFeature,
  CourseTwinHole,
  CourseTwinManifest,
  CourseTwinPoint,
  CourseTwinReplayDocument,
  CourseTwinReplayShot,
} from "@/lib/course-twin-contract";
import { cn } from "@/lib/utils";

type RuntimeMode = "flyover" | "replay";

const featureColours: Record<CourseTwinFeature["type"], string> = {
  course_boundary: "#24482d",
  rough: "#376d3b",
  fairway: "#56a45b",
  green: "#81c96d",
  bunker: "#d8c08a",
  water: "#2d7895",
  trees: "#163e25",
};

export function CourseTwinScene({
  manifest,
  replay,
}: {
  manifest: CourseTwinManifest;
  replay: CourseTwinReplayDocument | null;
}) {
  const [holeNumber, setHoleNumber] = useState(manifest.holes[0]?.holeNumber ?? 1);
  const [mode, setMode] = useState<RuntimeMode>(replay?.shots.length ? "replay" : "flyover");
  const [shotIndex, setShotIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState(0);
  const playbackRef = useRef(0);
  const selectedHole =
    manifest.holes.find((hole) => hole.holeNumber === holeNumber) ?? manifest.holes[0];
  const holeShots =
    replay?.shots.filter((shot) => shot.holeNumber === selectedHole.holeNumber) ?? [];
  const selectedShot = holeShots[Math.min(shotIndex, Math.max(0, holeShots.length - 1))] ?? null;
  const selectedHoleIndex = manifest.holes.findIndex(
    (hole) => hole.holeNumber === selectedHole.holeNumber,
  );

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    if (!playing || !selectedShot) return;
    let frame = 0;
    const startedAt = performance.now() - playbackRef.current * 3200;
    const tick = (now: number) => {
      const next = Math.min(1, (now - startedAt) / 3200);
      setPlayback(next);
      if (next < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, selectedShot]);

  const selectHole = (nextHoleNumber: number) => {
    setHoleNumber(nextHoleNumber);
    setShotIndex(0);
    setPlayback(0);
    setPlaying(false);
  };

  return (
    <div
      data-clubhouse-preserve-dark
      className="grid min-h-[calc(100dvh-5rem)] bg-[#07150e] text-white xl:grid-cols-[330px_minmax(0,1fr)]"
    >
      <aside className="order-2 border-t border-white/10 bg-[#0b1d13] p-4 xl:order-1 xl:border-r xl:border-t-0 xl:p-5">
        <div className="space-y-1">
          <Badge className="border border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
            Grade {manifest.quality.grade} prototype
          </Badge>
          <h1 className="pt-2 text-2xl font-semibold tracking-tight">{manifest.course.name}</h1>
          <p className="text-sm leading-6 text-emerald-100/70">
            Real mapped holes with semantic course surfaces. Prototype terrain is visual only until
            the LiDAR package passes verification.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
          <ModeButton active={mode === "flyover"} onClick={() => setMode("flyover")}>
            Flyover
          </ModeButton>
          <ModeButton
            active={mode === "replay"}
            disabled={!replay?.shots.length}
            onClick={() => setMode("replay")}
          >
            Replay
          </ModeButton>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
                Viewing
              </p>
              <p className="mt-1 text-xl font-semibold">Hole {selectedHole.holeNumber}</p>
              <p className="text-sm text-emerald-100/60">
                Par {selectedHole.par} · {selectedHole.yards} yd
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
                disabled={selectedHoleIndex <= 0}
                onClick={() => selectHole(manifest.holes[selectedHoleIndex - 1].holeNumber)}
                aria-label="Previous hole"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
                disabled={selectedHoleIndex >= manifest.holes.length - 1}
                onClick={() => selectHole(manifest.holes[selectedHoleIndex + 1].holeNumber)}
                aria-label="Next hole"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {manifest.holes.map((hole) => (
              <button
                key={hole.holeNumber}
                type="button"
                className={cn(
                  "min-h-10 rounded-lg border text-sm font-semibold transition-colors",
                  hole.holeNumber === selectedHole.holeNumber
                    ? "border-emerald-300 bg-emerald-300 text-[#092013]"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                )}
                onClick={() => selectHole(hole.holeNumber)}
              >
                {hole.holeNumber}
              </button>
            ))}
          </div>
        </div>

        {mode === "replay" ? (
          <ReplayControls
            replay={replay}
            shots={holeShots}
            selectedShot={selectedShot}
            shotIndex={shotIndex}
            playing={playing}
            playback={playback}
            onSelectShot={(index) => {
              setShotIndex(index);
              setPlayback(0);
              setPlaying(false);
            }}
            onToggle={() => {
              if (playback >= 1) setPlayback(0);
              setPlaying((current) => !current);
            }}
            onReset={() => {
              setPlaying(false);
              setPlayback(0);
            }}
          />
        ) : (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-emerald-100/70">
            Drag to orbit, scroll to zoom, and choose a hole to move the camera. Fairways, greens,
            hazards and tree zones come from saved semantic geometry.
          </div>
        )}

        <div className="mt-5 text-xs leading-5 text-emerald-100/50">
          {manifest.attribution.map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {item.label} · {item.licence}
            </a>
          ))}
        </div>
      </aside>

      <section className="order-1 relative min-h-[62dvh] overflow-hidden xl:order-2 xl:min-h-[calc(100dvh-5rem)]">
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 180, 240], fov: 48, near: 0.5, far: 6000 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          fallback={
            <div className="grid h-full min-h-[560px] place-items-center p-8 text-center">
              WebGL is unavailable. Use the hole table below for the accessible course view.
            </div>
          }
        >
          <color attach="background" args={["#8eb6b0"]} />
          <fog attach="fog" args={["#8eb6b0", 600, 2300]} />
          <ambientLight intensity={1.2} />
          <directionalLight
            castShadow
            position={[240, 420, 180]}
            intensity={2.5}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <CourseWorld
            manifest={manifest}
            selectedHole={selectedHole}
            selectedShot={mode === "replay" ? selectedShot : null}
            playback={playback}
          />
        </Canvas>
        <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-white/30 bg-[#07150e]/78 px-3 py-2 text-xs font-medium text-emerald-50 shadow-lg backdrop-blur">
          Semantic Course Twin · prototype terrain
        </div>
      </section>

      <table className="sr-only">
        <caption>{manifest.course.name} Course Twin holes</caption>
        <thead>
          <tr>
            <th>Hole</th>
            <th>Par</th>
            <th>Yards</th>
            <th>Replay shots</th>
          </tr>
        </thead>
        <tbody>
          {manifest.holes.map((hole) => (
            <tr key={hole.holeNumber}>
              <td>{hole.holeNumber}</td>
              <td>{hole.par}</td>
              <td>{hole.yards}</td>
              <td>
                {replay?.shots.filter((shot) => shot.holeNumber === hole.holeNumber).length ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseWorld({
  manifest,
  selectedHole,
  selectedShot,
  playback,
}: {
  manifest: CourseTwinManifest;
  selectedHole: CourseTwinHole;
  selectedShot: CourseTwinReplayShot | null;
  playback: number;
}) {
  const bounds = manifest.bounds;
  const center: [number, number, number] = [
    (selectedHole.tee[0] + selectedHole.green[0]) / 2,
    0,
    (selectedHole.tee[2] + selectedHole.green[2]) / 2,
  ];

  return (
    <group>
      <Terrain bounds={bounds} />
      {manifest.features.map((feature) => (
        <SemanticFeature key={feature.id} feature={feature} />
      ))}
      {manifest.holes.map((hole) => (
        <HoleGeometry key={hole.holeNumber} hole={hole} selected={hole === selectedHole} />
      ))}
      {selectedShot ? <ReplayTracer shot={selectedShot} playback={playback} /> : null}
      <CameraFocus hole={selectedHole} />
      <OrbitControls
        makeDefault
        target={center}
        minDistance={45}
        maxDistance={950}
        maxPolarAngle={Math.PI / 2.08}
        enableDamping
      />
    </group>
  );
}

function Terrain({ bounds }: { bounds: CourseTwinManifest["bounds"] }) {
  const geometry = useMemo(() => {
    const width = Math.max(300, bounds.maxX - bounds.minX);
    const depth = Math.max(300, bounds.maxZ - bounds.minZ);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const plane = new THREE.PlaneGeometry(width, depth, 72, 72);
    plane.rotateX(-Math.PI / 2);
    const position = plane.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index) + centerX;
      const z = position.getZ(index) + centerZ;
      position.setXYZ(index, x, terrainHeight(x, z), z);
    }
    position.needsUpdate = true;
    plane.computeVertexNormals();
    return plane;
  }, [bounds]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#315c35" roughness={0.96} metalness={0} />
    </mesh>
  );
}

function SemanticFeature({ feature }: { feature: CourseTwinFeature }) {
  const shapes = useMemo(
    () =>
      feature.rings.slice(0, 1).map((ring) => {
        const shape = new THREE.Shape();
        ring.forEach((point, index) => {
          if (index === 0) shape.moveTo(point[0], -point[2]);
          else shape.lineTo(point[0], -point[2]);
        });
        shape.closePath();
        return shape;
      }),
    [feature.rings],
  );
  if (feature.type === "course_boundary") return null;
  const height = feature.type === "water" ? 0.05 : 0.22;
  return shapes.map((shape, index) => (
    <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[0, height, 0]} receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={featureColours[feature.type]}
        roughness={feature.type === "water" ? 0.35 : 0.93}
        transparent={feature.type === "trees"}
        opacity={feature.type === "trees" ? 0.7 : 1}
      />
    </mesh>
  ));
}

function HoleGeometry({ hole, selected }: { hole: CourseTwinHole; selected: boolean }) {
  const points = hole.centerline.map(toTerrainPoint);
  const tee = toTerrainPoint(hole.tee);
  const green = toTerrainPoint(hole.green);
  return (
    <group>
      <Line
        points={points}
        color={selected ? "#efffb5" : "#d7f5d1"}
        lineWidth={selected ? 4 : 1.25}
        transparent
        opacity={selected ? 1 : 0.42}
      />
      <mesh position={tee} castShadow>
        <cylinderGeometry args={[3.5, 3.5, 0.7, 24]} />
        <meshStandardMaterial color={selected ? "#f6f3df" : "#9bc59c"} />
      </mesh>
      <mesh position={green} castShadow>
        <cylinderGeometry args={[5, 5, 0.85, 24]} />
        <meshStandardMaterial color={selected ? "#dfff84" : "#75a96f"} />
      </mesh>
    </group>
  );
}

function ReplayTracer({ shot, playback }: { shot: CourseTwinReplayShot; playback: number }) {
  const trajectory = shot.trajectory.map(toTerrainPointWithAltitude);
  const roll = [toTerrainPoint(shot.carryEnd), toTerrainPoint(shot.totalEnd)];
  const marker = pointOnPolyline(trajectory, playback);
  return (
    <group>
      <Line points={trajectory} color="#f8ff84" lineWidth={4} transparent opacity={0.9} />
      {shot.rollProvenance === "reconstructed" ? (
        <Line points={roll} color="#ffffff" lineWidth={2} dashed dashSize={3} gapSize={2} />
      ) : null}
      <mesh position={marker} castShadow>
        <sphereGeometry args={[2.3, 20, 20]} />
        <meshStandardMaterial color="#ffffff" emissive="#e7ff6a" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function CameraFocus({ hole }: { hole: CourseTwinHole }) {
  const { camera } = useThree();
  useEffect(() => {
    const tee = toTerrainPoint(hole.tee);
    const green = toTerrainPoint(hole.green);
    const dx = green[0] - tee[0];
    const dz = green[2] - tee[2];
    const length = Math.max(90, Math.hypot(dx, dz));
    camera.position.set(tee[0] - dz * 0.32, Math.min(240, length * 0.65), tee[2] + dx * 0.32);
    camera.lookAt((tee[0] + green[0]) / 2, 0, (tee[2] + green[2]) / 2);
  }, [camera, hole]);
  return null;
}

function ReplayControls({
  replay,
  shots,
  selectedShot,
  shotIndex,
  playing,
  playback,
  onSelectShot,
  onToggle,
  onReset,
}: {
  replay: CourseTwinReplayDocument | null;
  shots: CourseTwinReplayShot[];
  selectedShot: CourseTwinReplayShot | null;
  shotIndex: number;
  playing: boolean;
  playback: number;
  onSelectShot: (index: number) => void;
  onToggle: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
        {replay?.session.title ?? "Shot replay"}
      </p>
      {selectedShot ? (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Shot {selectedShot.holeShotNumber ?? shotIndex + 1}</p>
              <p className="text-sm text-emerald-100/60">
                {selectedShot.clubType} · {formatYards(selectedShot.metrics.carryYd.value)} carry
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
                onClick={onToggle}
                aria-label={playing ? "Pause replay" : "Play replay"}
              >
                {playing ? <CirclePause className="size-5" /> : <CirclePlay className="size-5" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
                onClick={onReset}
                aria-label="Reset replay"
              >
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#e7ff6a]" style={{ width: `${playback * 100}%` }} />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {shots.map((shot, index) => (
              <button
                key={shot.id}
                type="button"
                className={cn(
                  "min-w-14 rounded-lg border px-3 py-2 text-sm font-semibold",
                  index === shotIndex
                    ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                    : "border-white/10 bg-white/5",
                )}
                onClick={() => onSelectShot(index)}
              >
                #{shot.holeShotNumber ?? index + 1}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-amber-100/70">
            Measured metrics · derived course placement · reconstructed flight and roll.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-emerald-100/60">
          No imported launch-monitor shots are assigned to this hole.
        </p>
      )}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "min-h-10 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-white text-[#102217]" : "text-emerald-100/65 hover:bg-white/5",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function terrainHeight(x: number, z: number) {
  return Math.sin(x / 95) * 4.2 + Math.cos(z / 130) * 3.2 + Math.sin((x + z) / 210) * 2.4;
}

function toTerrainPoint(point: CourseTwinPoint): [number, number, number] {
  return [point[0], terrainHeight(point[0], point[2]) + 1.1, point[2]];
}

function toTerrainPointWithAltitude(point: CourseTwinPoint): [number, number, number] {
  return [point[0], terrainHeight(point[0], point[2]) + point[1] + 1.3, point[2]];
}

function pointOnPolyline(
  points: Array<[number, number, number]>,
  ratio: number,
): [number, number, number] {
  if (points.length === 0) return [0, 0, 0];
  const scaled = Math.min(1, Math.max(0, ratio)) * (points.length - 1);
  const left = points[Math.floor(scaled)];
  const right = points[Math.min(points.length - 1, Math.ceil(scaled))];
  const amount = scaled - Math.floor(scaled);
  return [
    left[0] + (right[0] - left[0]) * amount,
    left[1] + (right[1] - left[1]) * amount,
    left[2] + (right[2] - left[2]) * amount,
  ];
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}
