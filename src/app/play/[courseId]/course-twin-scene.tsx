"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  LocateFixed,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

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
import {
  createCourseTwinTerrainSampler,
  decodeCourseTwinHeightmap,
  type CourseTwinTerrainSampler,
} from "@/lib/course-twin-terrain";
import { courseTwinFeatureContains, courseTwinRingArea } from "@/lib/course-twin-surface";
import { cn } from "@/lib/utils";

type RuntimeMode = "flyover" | "replay";
type CameraView = "golfer" | "aerial";
type CameraControlAction = "orbit-left" | "orbit-right" | "zoom-in" | "zoom-out" | "reset";
type CameraCommand = { id: number; action: CameraControlAction } | null;

const proceduralTextureCache = new Map<string, THREE.CanvasTexture>();
const treeBillboards = [
  { url: "/course-twins/common/vegetation/billboards/tree-oak.png?v=2", aspect: 429 / 410 },
  { url: "/course-twins/common/vegetation/billboards/tree-birch.png?v=2", aspect: 258 / 436 },
  {
    url: "/course-twins/common/vegetation/billboards/tree-sycamore.png?v=2",
    aspect: 414 / 443,
  },
  {
    url: "/course-twins/common/vegetation/billboards/tree-windswept.png?v=2",
    aspect: 372 / 443,
  },
] as const;
const bushBillboards = [
  {
    url: "/course-twins/common/vegetation/billboards/bush-hawthorn.png?v=2",
    aspect: 331 / 384,
  },
  {
    url: "/course-twins/common/vegetation/billboards/bush-white-flower.png?v=2",
    aspect: 384 / 318,
  },
  {
    url: "/course-twins/common/vegetation/billboards/bush-dog-rose.png?v=2",
    aspect: 351 / 384,
  },
  {
    url: "/course-twins/common/vegetation/billboards/bush-native-evergreen.png?v=2",
    aspect: 384 / 379,
  },
] as const;

[...treeBillboards, ...bushBillboards].forEach(({ url }) => useTexture.preload(url));

type PbrSurfaceType = "tee" | "rough" | "fairway" | "green" | "bunker";

const pbrSurfaceAssets: Record<
  PbrSurfaceType,
  { asset: string; metresPerTile: number; normalScale: number }
> = {
  green: { asset: "Grass008", metresPerTile: 1.1, normalScale: 0.32 },
  tee: { asset: "Grass005", metresPerTile: 1.35, normalScale: 0.42 },
  fairway: { asset: "Grass005", metresPerTile: 2.2, normalScale: 0.48 },
  rough: { asset: "Grass001", metresPerTile: 3.6, normalScale: 0.78 },
  bunker: { asset: "Ground080", metresPerTile: 1.25, normalScale: 1.15 },
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
  const [cameraView, setCameraView] = useState<CameraView>("golfer");
  const [shotIndex, setShotIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState(0);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>(null);
  const [terrainSamples, setTerrainSamples] = useState<Float32Array | null>(null);
  const [terrainError, setTerrainError] = useState<string | null>(null);
  const playbackRef = useRef(0);
  const cameraCommandIdRef = useRef(0);
  const terrainAsset = manifest.terrain.heightmap;
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

  useEffect(() => {
    if (!terrainAsset) return;
    const controller = new AbortController();
    void fetch(terrainAsset.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Terrain package returned ${response.status}.`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        setTerrainError(null);
        setTerrainSamples(decodeCourseTwinHeightmap(buffer, terrainAsset));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTerrainError(error instanceof Error ? error.message : "Terrain package failed to load.");
      });
    return () => controller.abort();
  }, [terrainAsset]);

  const sampleTerrain = useMemo(
    () =>
      terrainAsset && terrainSamples
        ? createCourseTwinTerrainSampler(terrainAsset, terrainSamples)
        : null,
    [terrainAsset, terrainSamples],
  );

  useEffect(() => {
    const gameWindow = window as typeof window & {
      render_game_to_text?: () => string;
      advanceTime?: (milliseconds: number) => void;
    };
    gameWindow.render_game_to_text = () =>
      JSON.stringify({
        coordinateSystem: "local metres: +x east, +y up, +z south",
        course: manifest.course.name,
        terrain: {
          kind: manifest.terrain.kind,
          status: terrainError ? "error" : sampleTerrain ? "ready" : "loading",
          resolutionM: manifest.terrain.resolutionM,
        },
        mode,
        cameraView,
        cameraCommand: cameraCommand?.action ?? null,
        hole: selectedHole.holeNumber,
        visibleShotCount: selectedShot ? 1 : 0,
        selectedShotIndex: selectedShot ? shotIndex : null,
        shot: selectedShot
          ? {
              id: selectedShot.id,
              club: selectedShot.clubType,
              playback: Number(playback.toFixed(3)),
              start: selectedShot.start,
              totalEnd: selectedShot.totalEnd,
            }
          : null,
      });
    gameWindow.advanceTime = (milliseconds) => {
      setPlaying(false);
      setPlayback((current) => Math.min(1, current + Math.max(0, milliseconds) / 3200));
    };
    return () => {
      delete gameWindow.render_game_to_text;
      delete gameWindow.advanceTime;
    };
  }, [
    cameraCommand,
    cameraView,
    manifest,
    mode,
    playback,
    sampleTerrain,
    selectedHole,
    selectedShot,
    shotIndex,
    terrainError,
  ]);

  const selectHole = (nextHoleNumber: number) => {
    setHoleNumber(nextHoleNumber);
    setShotIndex(0);
    setPlayback(0);
    setPlaying(false);
    setCameraCommand(null);
  };

  const issueCameraCommand = (action: CameraControlAction) => {
    cameraCommandIdRef.current += 1;
    setCameraCommand({ id: cameraCommandIdRef.current, action });
  };

  return (
    <div
      data-clubhouse-preserve-dark
      className="grid min-h-[calc(100dvh-5rem)] bg-[#07150e] text-white xl:grid-cols-[330px_minmax(0,1fr)]"
    >
      <aside className="order-2 border-t border-white/10 bg-[#0b1d13] p-4 xl:order-1 xl:border-r xl:border-t-0 xl:p-5">
        <div className="space-y-1">
          <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
            Grade {manifest.quality.grade} · {manifest.terrain.resolutionM?.toFixed(1)} m terrain
          </Badge>
          <h1 className="pt-2 text-2xl font-semibold tracking-tight">{manifest.course.name}</h1>
          <p className="text-sm leading-6 text-emerald-100/70">
            Real mapped holes over Environment Agency LiDAR terrain and georeferenced aerial
            reference imagery. Green contours remain unverified for putting.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
          <ModeButton
            active={mode === "flyover"}
            onClick={() => {
              setMode("flyover");
              setCameraCommand(null);
            }}
          >
            Flyover
          </ModeButton>
          <ModeButton
            active={mode === "replay"}
            disabled={!replay?.shots.length}
            onClick={() => {
              setMode("replay");
              setCameraView("golfer");
              setCameraCommand(null);
            }}
          >
            Replay
          </ModeButton>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
          <ModeButton
            active={cameraView === "golfer"}
            onClick={() => {
              setCameraView("golfer");
              setCameraCommand(null);
            }}
          >
            {mode === "replay" ? "Shot view" : "Golfer view"}
          </ModeButton>
          <ModeButton
            active={cameraView === "aerial"}
            onClick={() => {
              setCameraView("aerial");
              setCameraCommand(null);
            }}
          >
            Aerial view
          </ModeButton>
        </div>

        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
              Camera controls
            </p>
            <p className="text-[11px] text-emerald-100/45">Drag to orbit · scroll to zoom</p>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            <CameraControlButton
              label="Orbit camera left"
              onClick={() => issueCameraCommand("orbit-left")}
            >
              <ChevronLeft className="size-4" />
            </CameraControlButton>
            <CameraControlButton
              label="Zoom camera in"
              onClick={() => issueCameraCommand("zoom-in")}
            >
              <ZoomIn className="size-4" />
            </CameraControlButton>
            <CameraControlButton
              label={mode === "replay" ? "Reset camera to selected shot" : "Reset camera to tee"}
              onClick={() => issueCameraCommand("reset")}
            >
              <LocateFixed className="size-4" />
            </CameraControlButton>
            <CameraControlButton
              label="Zoom camera out"
              onClick={() => issueCameraCommand("zoom-out")}
            >
              <ZoomOut className="size-4" />
            </CameraControlButton>
            <CameraControlButton
              label="Orbit camera right"
              onClick={() => issueCameraCommand("orbit-right")}
            >
              <ChevronRight className="size-4" />
            </CameraControlButton>
          </div>
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
              setCameraView("golfer");
              setCameraCommand(null);
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
          <color attach="background" args={["#6aa3c6"]} />
          <fog attach="fog" args={["#a9c8cf", 900, 3_100]} />
          <hemisphereLight args={["#cce4ef", "#263a28", 0.82]} />
          <ambientLight intensity={0.14} />
          <directionalLight
            castShadow
            position={[-280, 330, 210]}
            intensity={1.45}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          {terrainAsset && terrainSamples && sampleTerrain ? (
            <Suspense fallback={null}>
              <CourseWorld
                manifest={manifest}
                terrainSamples={terrainSamples}
                sampleTerrain={sampleTerrain}
                selectedHole={selectedHole}
                selectedShot={mode === "replay" ? selectedShot : null}
                playback={playback}
                cameraView={cameraView}
                cameraCommand={cameraCommand}
              />
            </Suspense>
          ) : null}
        </Canvas>
        <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-white/30 bg-[#07150e]/78 px-3 py-2 text-xs font-medium text-emerald-50 shadow-lg backdrop-blur">
          {terrainError
            ? `Terrain unavailable · ${terrainError}`
            : sampleTerrain
              ? `LiDAR Course Twin · ${manifest.terrain.resolutionM?.toFixed(1)} m runtime mesh`
              : "Loading verified LiDAR terrain…"}
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
  terrainSamples,
  sampleTerrain,
  selectedHole,
  selectedShot,
  playback,
  cameraView,
  cameraCommand,
}: {
  manifest: CourseTwinManifest;
  terrainSamples: Float32Array;
  sampleTerrain: CourseTwinTerrainSampler;
  selectedHole: CourseTwinHole;
  selectedShot: CourseTwinReplayShot | null;
  playback: number;
  cameraView: CameraView;
  cameraCommand: CameraCommand;
}) {
  const cameraStart = selectedShot?.start ?? selectedHole.tee;
  const cameraEnd = selectedShot?.totalEnd ?? selectedHole.green;
  const holeLength = Math.max(
    1,
    Math.hypot(cameraEnd[0] - cameraStart[0], cameraEnd[2] - cameraStart[2]),
  );
  const focusDistance = selectedShot
    ? cameraView === "golfer"
      ? THREE.MathUtils.clamp(holeLength * 0.65, 24, 72)
      : THREE.MathUtils.clamp(holeLength * 0.75, 38, 165)
    : cameraView === "golfer"
      ? Math.min(holeLength * 0.46, 72)
      : Math.min(holeLength * 0.58, 165);
  const focusX = cameraStart[0] + ((cameraEnd[0] - cameraStart[0]) / holeLength) * focusDistance;
  const focusZ = cameraStart[2] + ((cameraEnd[2] - cameraStart[2]) / holeLength) * focusDistance;
  const center: [number, number, number] = [
    focusX,
    sampleTerrain(focusX, focusZ) + (selectedShot ? 0.6 : cameraView === "golfer" ? 2 : 0),
    focusZ,
  ];

  return (
    <group>
      <Terrain manifest={manifest} samples={terrainSamples} />
      <AtmosphericBackdrop
        terrainBounds={manifest.terrain.heightmap?.localBounds ?? manifest.bounds}
        sampleTerrain={sampleTerrain}
      />
      {manifest.features.map((feature) => (
        <SemanticFeature key={feature.id} feature={feature} sampleTerrain={sampleTerrain} />
      ))}
      <InstancedVegetation
        features={manifest.features}
        terrainBounds={manifest.terrain.heightmap?.localBounds ?? manifest.bounds}
        sampleTerrain={sampleTerrain}
      />
      {manifest.holes.map((hole) => (
        <HoleGeometry
          key={hole.holeNumber}
          hole={hole}
          selected={hole === selectedHole}
          dimmed={hole === selectedHole && Boolean(selectedShot)}
          sampleTerrain={sampleTerrain}
        />
      ))}
      {selectedShot ? (
        <ReplayTracer
          key={selectedShot.id}
          shot={selectedShot}
          playback={playback}
          active
          sampleTerrain={sampleTerrain}
        />
      ) : null}
      <CameraFocus
        hole={selectedHole}
        shot={selectedShot}
        sampleTerrain={sampleTerrain}
        view={cameraView}
        command={cameraCommand}
      />
      <OrbitControls
        makeDefault
        target={center}
        minDistance={12}
        maxDistance={950}
        maxPolarAngle={Math.PI / 2.08}
        enableDamping
      />
    </group>
  );
}

function Terrain({ manifest, samples }: { manifest: CourseTwinManifest; samples: Float32Array }) {
  const asset = manifest.terrain.heightmap;
  const imagery = manifest.terrain.imagery;
  if (!asset || !imagery) return null;
  return (
    <LidarTerrain
      asset={asset}
      imageryUrl={imagery.url}
      samples={samples}
      features={manifest.features}
    />
  );
}

function LidarTerrain({
  asset,
  imageryUrl,
  samples,
  features,
}: {
  asset: NonNullable<CourseTwinManifest["terrain"]["heightmap"]>;
  imageryUrl: string;
  samples: Float32Array;
  features: CourseTwinFeature[];
}) {
  const [texture, fairwayTexture, greenTexture, bunkerTexture] = useTexture([
    imageryUrl,
    "/course-twins/common/materials/Grass005-Color.jpg",
    "/course-twins/common/materials/Grass008-Color.jpg",
    "/course-twins/common/materials/Ground080-Color.jpg",
  ]);
  const masks = useMemo(
    () => createCourseTwinTerrainMasks(features, asset.localBounds),
    [asset.localBounds, features],
  );
  const { gl } = useThree();
  const geometry = useMemo(() => {
    const bounds = asset.localBounds;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const plane = new THREE.PlaneGeometry(width, depth, asset.width - 1, asset.height - 1);
    plane.rotateX(-Math.PI / 2);
    const position = plane.attributes.position;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index) + centerX;
      const z = position.getZ(index) + centerZ;
      position.setXYZ(index, x, samples[index], z);
    }
    position.needsUpdate = true;
    plane.computeVertexNormals();
    return plane;
  }, [asset, samples]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      masks.surface.dispose();
      masks.water.dispose();
    },
    [masks],
  );
  useEffect(() => {
    for (const surfaceTexture of [texture, fairwayTexture, greenTexture, bunkerTexture]) {
      surfaceTexture.colorSpace = THREE.SRGBColorSpace;
      surfaceTexture.wrapS = THREE.RepeatWrapping;
      surfaceTexture.wrapT = THREE.RepeatWrapping;
      surfaceTexture.anisotropy = Math.min(12, gl.capabilities.getMaxAnisotropy());
      surfaceTexture.needsUpdate = true;
    }
  }, [bunkerTexture, fairwayTexture, gl, greenTexture, texture]);
  const terrainWidth = asset.localBounds.maxX - asset.localBounds.minX;
  const terrainDepth = asset.localBounds.maxZ - asset.localBounds.minZ;
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.88}
        metalness={0}
        onBeforeCompile={(shader) => {
          shader.uniforms.courseSurfaceMask = { value: masks.surface };
          shader.uniforms.courseWaterMask = { value: masks.water };
          shader.uniforms.fairwayColourMap = { value: fairwayTexture };
          shader.uniforms.greenColourMap = { value: greenTexture };
          shader.uniforms.bunkerColourMap = { value: bunkerTexture };
          shader.uniforms.courseSurfaceRepeats = {
            value: new THREE.Vector3(terrainWidth / 2.2, terrainDepth / 2.2, terrainWidth / 1.25),
          };
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_pars_fragment>",
            `#include <map_pars_fragment>
uniform sampler2D courseSurfaceMask;
uniform sampler2D courseWaterMask;
uniform sampler2D fairwayColourMap;
uniform sampler2D greenColourMap;
uniform sampler2D bunkerColourMap;
uniform vec3 courseSurfaceRepeats;`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#ifdef USE_MAP
  vec4 aerialColour = texture2D(map, vMapUv);
  vec3 surfaceWeights = texture2D(courseSurfaceMask, vMapUv).rgb;
  float waterWeight = texture2D(courseWaterMask, vMapUv).r;
  vec3 fairwayColour = texture2D(fairwayColourMap, vMapUv * courseSurfaceRepeats.xy).rgb;
  vec3 greenColour = texture2D(greenColourMap, vMapUv * courseSurfaceRepeats.xy * 1.8).rgb;
  vec3 bunkerColour = texture2D(bunkerColourMap, vMapUv * courseSurfaceRepeats.zy).rgb;
  vec3 courseColour = aerialColour.rgb;
  courseColour = mix(courseColour, fairwayColour * vec3(0.76, 0.88, 0.72), surfaceWeights.r * 0.66);
  courseColour = mix(courseColour, greenColour * vec3(0.78, 0.96, 0.73), surfaceWeights.g * 0.78);
  courseColour = mix(courseColour, bunkerColour * vec3(1.0, 0.94, 0.82), surfaceWeights.b * 0.94);
  vec3 reflectedWater = mix(courseColour * vec3(0.42, 0.63, 0.68), vec3(0.18, 0.43, 0.52), 0.42);
  courseColour = mix(courseColour, reflectedWater, waterWeight * 0.62);
  diffuseColor *= vec4(courseColour, aerialColour.a);
#endif`,
          );
        }}
        customProgramCacheKey={() => "course-twin-terrain-splat-v1"}
      />
    </mesh>
  );
}

function createCourseTwinTerrainMasks(
  features: CourseTwinFeature[],
  bounds: CourseTwinManifest["bounds"],
) {
  const size = 1024;
  const surfaceSource = document.createElement("canvas");
  const waterSource = document.createElement("canvas");
  surfaceSource.width = size;
  surfaceSource.height = size;
  waterSource.width = size;
  waterSource.height = size;
  const surfaceContext = surfaceSource.getContext("2d");
  const waterContext = waterSource.getContext("2d");
  if (!surfaceContext || !waterContext) throw new Error("Course surface masks are unavailable.");
  surfaceContext.fillStyle = "#000000";
  surfaceContext.fillRect(0, 0, size, size);
  waterContext.fillStyle = "#000000";
  waterContext.fillRect(0, 0, size, size);

  const orderedTypes: Array<{ type: CourseTwinFeature["type"]; colour: string }> = [
    { type: "fairway", colour: "#ff0000" },
    { type: "tee", colour: "#00ff00" },
    { type: "green", colour: "#00ff00" },
    { type: "bunker", colour: "#0000ff" },
  ];
  for (const { type, colour } of orderedTypes) {
    surfaceContext.fillStyle = colour;
    for (const feature of features.filter((candidate) => candidate.type === type)) {
      drawCourseTwinMaskFeature(surfaceContext, feature, bounds, size);
    }
  }
  waterContext.fillStyle = "#ffffff";
  for (const feature of features.filter((candidate) => candidate.type === "water")) {
    drawCourseTwinMaskFeature(waterContext, feature, bounds, size);
  }

  return {
    surface: featherCourseTwinMask(surfaceSource, 2.8),
    water: featherCourseTwinMask(waterSource, 2.2),
  };
}

function drawCourseTwinMaskFeature(
  context: CanvasRenderingContext2D,
  feature: CourseTwinFeature,
  bounds: CourseTwinManifest["bounds"],
  size: number,
) {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const depth = Math.max(1, bounds.maxZ - bounds.minZ);
  for (const ring of feature.rings.slice(0, 1)) {
    if (ring.length < 3) continue;
    context.beginPath();
    ring.forEach((point, index) => {
      const x = ((point[0] - bounds.minX) / width) * size;
      const y = ((point[2] - bounds.minZ) / depth) * size;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fill();
  }
}

function featherCourseTwinMask(source: HTMLCanvasElement, blurPx: number) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Course surface mask feathering is unavailable.");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = `blur(${blurPx}px)`;
  context.drawImage(source, 0, 0);
  context.filter = "none";
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function SemanticFeature({
  feature,
  sampleTerrain,
}: {
  feature: CourseTwinFeature;
  sampleTerrain: CourseTwinTerrainSampler;
}) {
  const featureCenter = useMemo(() => {
    const ring = feature.rings[0] ?? [];
    if (ring.length === 0) return new THREE.Vector3();
    return new THREE.Vector3(
      ring.reduce((total, point) => total + point[0], 0) / ring.length,
      ring.reduce((total, point) => total + sampleTerrain(point[0], point[2]), 0) / ring.length,
      ring.reduce((total, point) => total + point[2], 0) / ring.length,
    );
  }, [feature.rings, sampleTerrain]);
  const geometries = useMemo(() => {
    return feature.rings.slice(0, 1).map((ring) => {
      const shape = new THREE.Shape();
      ring.forEach((point, index) => {
        if (index === 0) shape.moveTo(point[0], -point[2]);
        else shape.lineTo(point[0], -point[2]);
      });
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI / 2);
      const position = geometry.attributes.position;
      const waterHeight =
        feature.type === "water"
          ? ring.reduce((total, point) => total + sampleTerrain(point[0], point[2]), 0) /
              Math.max(1, ring.length) +
            0.18
          : null;
      const surfaceOffset =
        feature.type === "bunker" ? -0.16 : feature.type === "course_boundary" ? 0.1 : 0.28;
      for (let index = 0; index < position.count; index += 1) {
        const x = position.getX(index);
        const z = position.getZ(index);
        position.setY(index, waterHeight ?? sampleTerrain(x, z) + surfaceOffset);
      }
      if (isPbrSurface(feature.type)) {
        const tileSize = pbrSurfaceAssets[feature.type].metresPerTile;
        const uv = new Float32Array(position.count * 2);
        for (let index = 0; index < position.count; index += 1) {
          uv[index * 2] = position.getX(index) / tileSize;
          uv[index * 2 + 1] = position.getZ(index) / tileSize;
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
      return geometry;
    });
  }, [feature.rings, feature.type, sampleTerrain]);
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries]);
  if (feature.type !== "water") return null;
  return geometries.map((geometry, index) => (
    <group key={index}>
      <mesh geometry={geometry} receiveShadow>
        <WaterMaterial center={featureCenter} />
      </mesh>
    </group>
  ));
}

function isPbrSurface(type: CourseTwinFeature["type"]): type is PbrSurfaceType {
  return type in pbrSurfaceAssets;
}

function WaterMaterial({ center }: { center: THREE.Vector3 }) {
  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const normalMap = useMemo(() => waterNormalTexture(), []);
  useFrame(({ camera }) => {
    if (!materialRef.current) return;
    const distance = camera.position.distanceTo(center);
    const proximity = 1 - THREE.MathUtils.smoothstep(distance, 45, 190);
    materialRef.current.opacity = THREE.MathUtils.lerp(0.08, 0.28, proximity);
  });
  return (
    <meshPhysicalMaterial
      ref={materialRef}
      color="#3e879d"
      normalMap={normalMap}
      normalScale={new THREE.Vector2(0.34, 0.34)}
      roughness={0.13}
      metalness={0.02}
      clearcoat={0.92}
      clearcoatRoughness={0.12}
      transparent
      opacity={0.08}
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={-3}
    />
  );
}

function waterNormalTexture() {
  const cached = proceduralTextureCache.get("water-normal");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable.");
  const image = context.createImageData(canvas.width, canvas.height);
  const random = seededRandom(hashString("water-ripples"));
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const waveX = Math.sin(y * 0.31 + x * 0.06) * 17 + (random() - 0.5) * 5;
      const waveY = Math.cos(x * 0.22 - y * 0.04) * 10 + (random() - 0.5) * 4;
      image.data[index] = clampColour(128 + waveX);
      image.data[index + 1] = clampColour(128 + waveY);
      image.data[index + 2] = 238;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.anisotropy = 4;
  proceduralTextureCache.set("water-normal", texture);
  return texture;
}

function clampColour(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function AtmosphericBackdrop({
  terrainBounds,
  sampleTerrain,
}: {
  terrainBounds: CourseTwinManifest["bounds"];
  sampleTerrain: CourseTwinTerrainSampler;
}) {
  const centerX = (terrainBounds.minX + terrainBounds.maxX) / 2;
  const centerZ = (terrainBounds.minZ + terrainBounds.maxZ) / 2;
  const spanX = terrainBounds.maxX - terrainBounds.minX;
  const spanZ = terrainBounds.maxZ - terrainBounds.minZ;
  const radius = Math.max(spanX, spanZ) * 0.72 + 260;
  const baseY = sampleTerrain(centerX, centerZ) - 8;
  const skyTexture = useMemo(() => createSkyTexture(), []);
  const horizonTexture = useMemo(() => createHorizonTexture(), []);
  const cloudTexture = useMemo(() => createCloudTexture(), []);
  const clouds = Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    return {
      x: Math.cos(angle) * 0.76,
      y: 130 + ((index * 53) % 150),
      z: Math.sin(angle) * 0.76,
      width: 0.27 + ((index * 29) % 17) / 100,
      opacity: 0.42 + ((index * 13) % 19) / 100,
    };
  });

  return (
    <group>
      <mesh position={[centerX, baseY, centerZ]} renderOrder={-100}>
        <sphereGeometry args={[radius * 3.6, 48, 24]} />
        <meshBasicMaterial
          map={skyTexture}
          depthWrite={false}
          fog={false}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[centerX, baseY + 31, centerZ]} renderOrder={-20}>
        <cylinderGeometry args={[radius, radius, 78, 96, 1, true]} />
        <meshBasicMaterial
          map={horizonTexture}
          transparent
          alphaTest={0.025}
          depthWrite={false}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      {clouds.map((cloud, index) => (
        <sprite
          key={index}
          position={[centerX + radius * cloud.x, baseY + cloud.y, centerZ + radius * cloud.z]}
          scale={[radius * cloud.width, radius * cloud.width * 0.2, 1]}
          renderOrder={-30}
        >
          <spriteMaterial
            map={cloudTexture}
            color="#f4f7f6"
            opacity={cloud.opacity}
            transparent
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

function createSkyTexture() {
  const cached = proceduralTextureCache.get("course-twin-sky");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 1_024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create sky texture context.");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#3d79aa");
  gradient.addColorStop(0.38, "#619cc1");
  gradient.addColorStop(0.7, "#9bc2d0");
  gradient.addColorStop(0.88, "#c2d5d5");
  gradient.addColorStop(1, "#d2d7c9");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const cloudBands = [
    { x: 92, y: 142, width: 210, opacity: 0.42 },
    { x: 330, y: 104, width: 160, opacity: 0.3 },
    { x: 550, y: 174, width: 250, opacity: 0.48 },
    { x: 830, y: 124, width: 190, opacity: 0.34 },
    { x: 1_004, y: 196, width: 230, opacity: 0.4 },
  ];
  for (const cloud of cloudBands) {
    for (let lobe = -2; lobe <= 2; lobe += 1) {
      const x = cloud.x + lobe * cloud.width * 0.17;
      const y = cloud.y - (2 - Math.abs(lobe)) * 13;
      const radiusX = cloud.width * (0.24 + (2 - Math.abs(lobe)) * 0.045);
      const radiusY = 34 + (2 - Math.abs(lobe)) * 9;
      const cloudGradient = context.createRadialGradient(x, y, 1, x, y, radiusX);
      cloudGradient.addColorStop(0, `rgba(244,248,249,${cloud.opacity})`);
      cloudGradient.addColorStop(0.55, `rgba(238,245,247,${cloud.opacity * 0.68})`);
      cloudGradient.addColorStop(1, "rgba(228,239,242,0)");
      context.save();
      context.translate(x, y);
      context.scale(1, radiusY / radiusX);
      context.translate(-x, -y);
      context.fillStyle = cloudGradient;
      context.fillRect(x - radiusX, y - radiusX, radiusX * 2, radiusX * 2);
      context.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  proceduralTextureCache.set("course-twin-sky", texture);
  return texture;
}

function createCloudTexture() {
  const cached = proceduralTextureCache.get("course-twin-clouds");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create cloud texture context.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const lobes = [
    [70, 126, 64, 0.46],
    [146, 98, 94, 0.72],
    [242, 80, 118, 0.84],
    [344, 98, 104, 0.68],
    [432, 128, 70, 0.4],
  ] as const;
  for (const [x, y, radius, opacity] of lobes) {
    const gradient = context.createRadialGradient(x, y, radius * 0.08, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
    gradient.addColorStop(0.58, `rgba(246,249,250,${opacity * 0.78})`);
    gradient.addColorStop(1, "rgba(238,246,248,0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  proceduralTextureCache.set("course-twin-clouds", texture);
  return texture;
}

function createHorizonTexture() {
  const cached = proceduralTextureCache.get("course-twin-horizon");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create horizon texture context.");
  const random = seededRandom(hashString("bootle-distant-horizon"));
  context.clearRect(0, 0, canvas.width, canvas.height);
  const groundGradient = context.createLinearGradient(0, 168, 0, 256);
  groundGradient.addColorStop(0, "rgba(69,94,74,0)");
  groundGradient.addColorStop(0.35, "rgba(66,84,66,0.54)");
  groundGradient.addColorStop(1, "rgba(31,49,35,0.94)");
  context.fillStyle = groundGradient;
  context.fillRect(0, 164, canvas.width, 92);

  for (let index = 0; index < 360; index += 1) {
    const x = random() * canvas.width;
    const width = 5 + random() * 15;
    const height = 14 + random() * 34;
    const baseline = 192 + random() * 10;
    context.fillStyle = `rgba(${34 + Math.floor(random() * 18)},${
      65 + Math.floor(random() * 24)
    },${41 + Math.floor(random() * 16)},${0.7 + random() * 0.22})`;
    context.beginPath();
    context.moveTo(x - width * 0.54, baseline);
    context.quadraticCurveTo(x - width * 0.66, baseline - height * 0.45, x, baseline - height);
    context.quadraticCurveTo(
      x + width * 0.68,
      baseline - height * 0.46,
      x + width * 0.54,
      baseline,
    );
    context.closePath();
    context.fill();
  }

  for (let index = 0; index < 12; index += 1) {
    const x = random() * canvas.width;
    const width = 18 + random() * 34;
    const roofY = 190 + random() * 8;
    context.fillStyle = "rgba(88,89,82,0.58)";
    context.fillRect(x, roofY, width, 16 + random() * 9);
    context.fillStyle = "rgba(103,84,73,0.62)";
    context.beginPath();
    context.moveTo(x - 3, roofY);
    context.lineTo(x + width * 0.5, roofY - 8 - random() * 6);
    context.lineTo(x + width + 3, roofY);
    context.closePath();
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  proceduralTextureCache.set("course-twin-horizon", texture);
  return texture;
}

type VegetationInstance = {
  x: number;
  y: number;
  z: number;
  height: number;
  widthScale: number;
  tint: number;
  variant: number;
  rotation: number;
};

function InstancedVegetation({
  features,
  terrainBounds,
  sampleTerrain,
}: {
  features: CourseTwinFeature[];
  terrainBounds: CourseTwinManifest["bounds"];
  sampleTerrain: CourseTwinTerrainSampler;
}) {
  const trees = useMemo(
    () => buildTreeInstances(features, terrainBounds, sampleTerrain),
    [features, sampleTerrain, terrainBounds],
  );
  const bushes = useMemo(
    () => buildBushInstances(features, terrainBounds, sampleTerrain),
    [features, sampleTerrain, terrainBounds],
  );
  const textures = useTexture([
    ...treeBillboards.map(({ url }) => url),
    ...bushBillboards.map(({ url }) => url),
  ]);

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    });
  }, [textures]);

  if (trees.length === 0 && bushes.length === 0) return null;
  return (
    <group>
      {treeBillboards.map((asset, variant) => (
        <InstancedVegetationBillboard
          key={asset.url}
          texture={textures[variant]}
          aspect={asset.aspect}
          instances={trees.filter((tree) => tree.variant === variant)}
        />
      ))}
      {bushBillboards.map((asset, variant) => (
        <InstancedVegetationBillboard
          key={asset.url}
          texture={textures[treeBillboards.length + variant]}
          aspect={asset.aspect}
          instances={bushes.filter((bush) => bush.variant === variant)}
        />
      ))}
    </group>
  );
}

function InstancedVegetationBillboard({
  texture,
  aspect,
  instances,
}: {
  texture: THREE.Texture;
  aspect: number;
  instances: VegetationInstance[];
}) {
  if (instances.length === 0) return null;
  return (
    <group>
      <InstancedBillboardPlane
        texture={texture}
        aspect={aspect}
        instances={instances}
        planeRotation={0}
      />
      <InstancedBillboardPlane
        texture={texture}
        aspect={aspect}
        instances={instances}
        planeRotation={Math.PI / 2}
      />
    </group>
  );
}

function InstancedBillboardPlane({
  texture,
  aspect,
  instances,
  planeRotation,
}: {
  texture: THREE.Texture;
  aspect: number;
  instances: VegetationInstance[];
  planeRotation: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    instances.forEach((instance, index) => {
      transform.position.set(instance.x, instance.y + instance.height / 2, instance.z);
      transform.rotation.set(0, instance.rotation + planeRotation, 0);
      transform.scale.set(instance.height * aspect * instance.widthScale, instance.height, 1);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [aspect, instances, planeRotation]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, instances.length]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        map={texture}
        alphaTest={0.28}
        transparent
        side={THREE.DoubleSide}
        roughness={0.96}
        metalness={0}
      />
    </instancedMesh>
  );
}

function buildTreeInstances(
  features: CourseTwinFeature[],
  terrainBounds: CourseTwinManifest["bounds"],
  sampleTerrain: CourseTwinTerrainSampler,
) {
  const treeFeatures = features.filter((feature) => feature.type === "trees");
  const exclusionFeatures = features.filter((feature) =>
    ["tee", "fairway", "green", "bunker", "water"].includes(feature.type),
  );
  const instances: VegetationInstance[] = [];

  for (const feature of treeFeatures) {
    const ring = feature.rings[0];
    if (!ring || ring.length < 4) continue;
    const xs = ring.map((point) => point[0]);
    const zs = ring.map((point) => point[2]);
    const minX = Math.max(terrainBounds.minX, Math.min(...xs));
    const maxX = Math.min(terrainBounds.maxX, Math.max(...xs));
    const minZ = Math.max(terrainBounds.minZ, Math.min(...zs));
    const maxZ = Math.min(terrainBounds.maxZ, Math.max(...zs));
    if (minX >= maxX || minZ >= maxZ) continue;
    const targetCount = Math.min(96, Math.max(6, Math.round(courseTwinRingArea(ring) / 330)));
    const random = seededRandom(hashString(feature.id));
    let accepted = 0;
    for (let attempt = 0; attempt < targetCount * 28 && accepted < targetCount; attempt += 1) {
      const x = minX + random() * (maxX - minX);
      const z = minZ + random() * (maxZ - minZ);
      if (!courseTwinFeatureContains(feature, x, z)) continue;
      if (exclusionFeatures.some((candidate) => courseTwinFeatureContains(candidate, x, z))) {
        continue;
      }
      const variant = Math.floor(random() * treeBillboards.length);
      const height = 8.5 + random() * 8.5;
      instances.push({
        x,
        y: sampleTerrain(x, z),
        z,
        height,
        widthScale: 0.78 + random() * 0.46,
        tint: random() * 2 - 1,
        variant,
        rotation: random() * Math.PI * 2,
      });
      accepted += 1;
    }
  }
  return instances.slice(0, 650);
}

function buildBushInstances(
  features: CourseTwinFeature[],
  terrainBounds: CourseTwinManifest["bounds"],
  sampleTerrain: CourseTwinTerrainSampler,
) {
  const treeFeatures = features.filter((feature) => feature.type === "trees");
  const exclusionFeatures = features.filter((feature) =>
    ["tee", "fairway", "green", "bunker", "water"].includes(feature.type),
  );
  const instances: VegetationInstance[] = [];

  for (const feature of treeFeatures) {
    const ring = feature.rings[0];
    if (!ring || ring.length < 4) continue;
    const xs = ring.map((point) => point[0]);
    const zs = ring.map((point) => point[2]);
    const minX = Math.max(terrainBounds.minX, Math.min(...xs));
    const maxX = Math.min(terrainBounds.maxX, Math.max(...xs));
    const minZ = Math.max(terrainBounds.minZ, Math.min(...zs));
    const maxZ = Math.min(terrainBounds.maxZ, Math.max(...zs));
    if (minX >= maxX || minZ >= maxZ) continue;
    const targetCount = Math.min(126, Math.max(8, Math.round(courseTwinRingArea(ring) / 210)));
    const random = seededRandom(hashString(`${feature.id}:bushes`));
    let accepted = 0;
    for (let attempt = 0; attempt < targetCount * 24 && accepted < targetCount; attempt += 1) {
      const x = minX + random() * (maxX - minX);
      const z = minZ + random() * (maxZ - minZ);
      if (!courseTwinFeatureContains(feature, x, z)) continue;
      if (exclusionFeatures.some((candidate) => courseTwinFeatureContains(candidate, x, z))) {
        continue;
      }
      instances.push({
        x,
        y: sampleTerrain(x, z),
        z,
        height: 1.1 + random() * 2.1,
        widthScale: 0.82 + random() * 0.42,
        tint: random() * 2 - 1,
        variant: Math.floor(random() * bushBillboards.length),
        rotation: random() * Math.PI * 2,
      });
      accepted += 1;
    }
  }
  return instances.slice(0, 1_200);
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function HoleGeometry({
  hole,
  selected,
  dimmed,
  sampleTerrain,
}: {
  hole: CourseTwinHole;
  selected: boolean;
  dimmed: boolean;
  sampleTerrain: CourseTwinTerrainSampler;
}) {
  const points = hole.centerline.map((point) => toTerrainPoint(point, sampleTerrain));
  const tee = toTerrainPoint(hole.tee, sampleTerrain);
  const green = toTerrainPoint(hole.green, sampleTerrain);
  return (
    <group>
      <Line
        points={points}
        color={selected ? "#efffb5" : "#d7f5d1"}
        lineWidth={selected ? 2.4 : 0.8}
        transparent
        opacity={dimmed ? 0.16 : selected ? 1 : 0.42}
      />
      <mesh position={tee} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.16, 20]} />
        <meshStandardMaterial color={selected ? "#f7f4de" : "#a7c6a2"} roughness={0.72} />
      </mesh>
      {selected ? <HoleFlag position={green} /> : null}
    </group>
  );
}

function HoleFlag({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 4.1, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 8, 10]} />
        <meshStandardMaterial color="#f7f3df" roughness={0.5} />
      </mesh>
      <mesh position={[1.2, 7.1, 0]} castShadow>
        <planeGeometry args={[2.4, 1.25]} />
        <meshStandardMaterial color="#e7ff6a" side={THREE.DoubleSide} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.18, 20]} />
        <meshStandardMaterial color="#141f17" roughness={1} />
      </mesh>
    </group>
  );
}

function ReplayTracer({
  shot,
  playback,
  active,
  sampleTerrain,
}: {
  shot: CourseTwinReplayShot;
  playback: number;
  active: boolean;
  sampleTerrain: CourseTwinTerrainSampler;
}) {
  const trajectory = shot.trajectory.map((point) =>
    toTerrainPointWithAltitude(point, sampleTerrain),
  );
  const roll = [
    toTerrainPoint(shot.carryEnd, sampleTerrain),
    toTerrainPoint(shot.totalEnd, sampleTerrain),
  ];
  const marker = pointOnPolyline(trajectory, playback);
  return (
    <group>
      <Line
        points={trajectory}
        color={active ? "#f8ff84" : "#ffbd70"}
        lineWidth={active ? 2.1 : 1.05}
        transparent
        opacity={active ? 0.94 : 0.48}
      />
      {shot.rollProvenance === "reconstructed" ? (
        <Line
          points={roll}
          color={active ? "#ffffff" : "#ffd3a0"}
          lineWidth={active ? 2 : 1.1}
          dashed
          dashSize={3}
          gapSize={2}
          transparent
          opacity={active ? 0.9 : 0.45}
        />
      ) : null}
      {active ? (
        <mesh position={marker} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color="#ffffff" emissive="#e7ff6a" emissiveIntensity={1.4} />
        </mesh>
      ) : (
        <mesh position={trajectory.at(-1)}>
          <sphereGeometry args={[0.24, 12, 12]} />
          <meshStandardMaterial color="#ffbd70" emissive="#ff8a3d" emissiveIntensity={0.4} />
        </mesh>
      )}
    </group>
  );
}

function CameraFocus({
  hole,
  shot,
  sampleTerrain,
  view,
  command,
}: {
  hole: CourseTwinHole;
  shot: CourseTwinReplayShot | null;
  sampleTerrain: CourseTwinTerrainSampler;
  view: CameraView;
  command: CameraCommand;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const start = toTerrainPoint(shot?.start ?? hole.tee, sampleTerrain);
    const end = toTerrainPoint(shot?.totalEnd ?? hole.green, sampleTerrain);
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const length = Math.max(1, Math.hypot(dx, dz));
    const directionX = dx / length;
    const directionZ = dz / length;
    const targetDistance = shot
      ? view === "golfer"
        ? THREE.MathUtils.clamp(length * 0.65, 24, 72)
        : THREE.MathUtils.clamp(length * 0.75, 38, 165)
      : view === "golfer"
        ? Math.min(length * 0.46, 72)
        : Math.min(length * 0.58, 165);
    const targetX = start[0] + directionX * targetDistance;
    const targetZ = start[2] + directionZ * targetDistance;
    const targetY = sampleTerrain(targetX, targetZ) + (shot ? 0.6 : view === "golfer" ? 2.5 : 3);
    const target = new THREE.Vector3(targetX, targetY, targetZ);

    if (command && command.action !== "reset") {
      if (
        (command.action === "zoom-in" || command.action === "zoom-out") &&
        camera instanceof THREE.PerspectiveCamera
      ) {
        setPerspectiveFov(
          camera,
          THREE.MathUtils.clamp(camera.fov + (command.action === "zoom-in" ? -3 : 3), 36, 60),
        );
        return;
      }
      const offset = camera.position.clone().sub(target);
      if (command.action === "orbit-left" || command.action === "orbit-right") {
        offset.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          command.action === "orbit-left" ? Math.PI / 10 : -Math.PI / 10,
        );
      }
      camera.position.copy(target).add(offset);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      return;
    }

    if (camera instanceof THREE.PerspectiveCamera) setPerspectiveFov(camera, 48);

    if (view === "golfer") {
      const behindDistance = shot ? 9 : 14;
      const lateralDistance = shot ? 2.5 : 7;
      camera.position.set(
        start[0] - directionX * behindDistance - directionZ * lateralDistance,
        start[1] + (shot ? 3 : 11.5),
        start[2] - directionZ * behindDistance + directionX * lateralDistance,
      );
    } else {
      camera.position.set(
        start[0] - directionX * Math.min(62, length * 0.28) - directionZ * 42,
        start[1] + Math.min(140, Math.max(62, length * 0.34)),
        start[2] - directionZ * Math.min(62, length * 0.28) + directionX * 42,
      );
    }
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, command, hole, sampleTerrain, shot, view]);
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
                aria-label={`View shot ${shot.holeShotNumber ?? index + 1}`}
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

function CameraControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="grid min-h-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-emerald-50 transition-colors hover:border-emerald-300/30 hover:bg-emerald-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
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

function toTerrainPoint(
  point: CourseTwinPoint,
  sampleTerrain: CourseTwinTerrainSampler,
): [number, number, number] {
  return [point[0], sampleTerrain(point[0], point[2]) + 1.1, point[2]];
}

function toTerrainPointWithAltitude(
  point: CourseTwinPoint,
  sampleTerrain: CourseTwinTerrainSampler,
): [number, number, number] {
  return [point[0], sampleTerrain(point[0], point[2]) + point[1] + 1.3, point[2]];
}

function setPerspectiveFov(camera: THREE.PerspectiveCamera, fov: number) {
  const focalLength =
    (0.5 * camera.getFilmHeight()) / Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
  camera.setFocalLength(focalLength);
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
