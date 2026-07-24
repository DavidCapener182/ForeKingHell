"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, useTexture } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  ChevronLeft,
  ChevronRight,
  CarFront,
  CirclePause,
  CirclePlay,
  LocateFixed,
  Footprints,
  Copy,
  LogOut,
  Users,
  Radio,
  RotateCcw,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseTwinComms } from "@/app/play/[courseId]/course-twin-comms";
import type {
  CourseTwinEvidenceValue,
  CourseTwinFeature,
  CourseTwinHole,
  CourseTwinManifest,
  CourseTwinPoint,
  CourseTwinPuttingSurface,
  CourseTwinReplayDocument,
  CourseTwinReplayShot,
} from "@/lib/course-twin-contract";
import {
  bridgeShotToReplayShot,
  CourseTwinBridgeClient,
  type CourseTwinBridgeEvent,
  type CourseTwinBridgeStatus,
} from "@/lib/course-twin-bridge-client";
import {
  sampleCourseTwinSimulation,
  simulateCourseTwinReplayShot,
  type CourseTwinReplaySimulation,
  type CourseTwinSimulationFrame,
} from "@/lib/course-twin-physics";
import {
  appendCourseTwinRoundEventClient,
  CourseTwinRoundRequestError,
  courseTwinRoundHoleResumeState,
  courseTwinRoundPhysicalHoleNumber,
  createCourseTwinRoundClient,
  loadActiveCourseTwinRoundClient,
  loadCourseTwinRoundClient,
  type CourseTwinRoundClientDocument,
} from "@/lib/course-twin-round-client";
import {
  buildCourseTwinAutomaticGreenCompletion,
  buildCourseTwinManualGreenCompletion,
  courseTwinAutomaticPuttCount,
  courseTwinDistanceToPinYd,
  courseTwinHoleScoreLabel,
  courseTwinRoundScore,
  type CourseTwinHoleCompletedPayload,
  type CourseTwinRoundEventInput,
  type CourseTwinRoundRules,
  type CourseTwinShotEventPayload,
} from "@/lib/course-twin-round";
import {
  buildCourseTwinPuttEventPayload,
  buildCourseTwinPuttReplay,
  simulateCourseTwinPutt,
  type CourseTwinPuttResult,
} from "@/lib/course-twin-putting";
import {
  createCourseTwinSurfaceClassifier,
  courseTwinFeatureContains,
  courseTwinRingArea,
  type CourseTwinSurface,
} from "@/lib/course-twin-surface";
import {
  createCourseTwinTerrainSampler,
  decodeCourseTwinHeightmap,
  type CourseTwinTerrainSampler,
} from "@/lib/course-twin-terrain";
import type {
  CourseTwinStrategyClub,
  CourseTwinStrategyDocument,
} from "@/lib/course-twin-strategy";
import {
  buildCourseTwinVirtualShot,
  courseTwinAimDirection,
  courseTwinAimDirectionDegToPoint,
  courseTwinAimLimitDeg,
  courseTwinVirtualClubOptions,
  courseTwinVirtualShotKind,
  courseTwinVirtualShotKindOptions,
  type CourseTwinVirtualShot,
  type CourseTwinVirtualShotKind,
} from "@/lib/course-twin-virtual-round";
import { cn } from "@/lib/utils";

type RuntimeMode = "flyover" | "replay" | "strategy" | "play" | "live" | "explore";
type ExploreTransport = "walk" | "cart";
type CameraView = "golfer" | "aerial";
type CameraControlAction = "orbit-left" | "orbit-right" | "zoom-in" | "zoom-out" | "reset";
type CameraCommand = { id: number; action: CameraControlAction } | null;
const GOLFER_SHOT_CAMERA = {
  fov: 56,
  behindDistance: 4.5,
  lateralDistance: 0.85,
  eyeHeight: 1.72,
} as const;
const GOLFER_TEE_CAMERA = {
  fov: 56,
  behindDistance: 14,
  lateralDistance: 0,
  eyeHeight: 1.72,
} as const;
type StrategyLoadState = {
  holeNumber: number | null;
  status: "idle" | "loading" | "ready" | "error";
  document: CourseTwinStrategyDocument | null;
  error: string | null;
};
type BridgeLoadState = {
  status: "idle" | "detecting" | "available" | "pairing" | "connected" | "error";
  health: CourseTwinBridgeStatus | null;
  launchMonitorConnected: boolean;
  error: string | null;
};
type CourseTwinRoomClient = {
  id: string;
  inviteCode: string;
  currentUserId: string;
  visibility: "private" | "public";
  isHost: boolean;
  currentRole: "host" | "player" | "spectator";
  competition: boolean;
  spectatorLimit: number;
  sharedRoundVersion: number;
  sharedEventCount: number;
  finalEventHash: string | null;
  latestSharedEvent: {
    sequence: number;
    eventType: string;
    eventHash: string;
    createdAt: string;
  } | null;
  members: Array<{
    userId: string;
    displayName: string;
    role: "host" | "player" | "spectator";
    transport: ExploreTransport;
    holeNumber: number;
  }>;
};
type PublicCourseTwinRoom = {
  id: string;
  inviteCode: string;
  hostName: string;
  mode: string;
  competition: boolean;
  memberCount: number;
  maxPlayers: number;
  holeNumber: number;
  canJoin: boolean;
};
type RoomLoadState = {
  status: "idle" | "loading" | "ready" | "error";
  room: CourseTwinRoomClient | null;
  error: string | null;
};
type RoundSyncState = {
  status: "idle" | "saving" | "ready" | "error";
  error: string | null;
};

const defaultRoundRules: CourseTwinRoundRules = {
  windSpeedMph: 0,
  windDirectionDeg: 0,
  greenRule: "automatic_putts",
  mulligansAllowed: true,
  competition: false,
};

const proceduralTextureCache = new Map<string, THREE.CanvasTexture>();
const treeBillboards = [
  { url: "/course-twins/common/vegetation/billboards/tree-oak.png?v=2", aspect: 429 / 410 },
  { url: "/course-twins/common/vegetation/billboards/tree-birch.png?v=2", aspect: 258 / 436 },
  {
    url: "/course-twins/common/vegetation/billboards/tree-sycamore.png?v=2",
    aspect: 414 / 443,
    cropTop: 0.04,
  },
  {
    url: "/course-twins/common/vegetation/billboards/tree-windswept.png?v=2",
    aspect: 372 / 443,
    cropTop: 0.04,
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

function roundShotPayloadToReplayShot(
  shot: CourseTwinShotEventPayload & { clientEventId: string },
): CourseTwinReplayShot {
  return {
    id: `round-${shot.clientEventId}`,
    holeNumber: shot.holeNumber,
    holeShotNumber: shot.shotNumber,
    clubType: shot.clubType,
    start: shot.start,
    carryEnd: shot.carryEnd,
    totalEnd: shot.totalEnd,
    trajectory: [],
    metrics: {
      carryYd: roundShotEvidence(shot.metrics.carryYd, shot.source),
      totalYd: roundShotEvidence(shot.metrics.totalYd, shot.source),
      sideCarryYd: roundShotEvidence(null, shot.source),
      apexFt: roundShotEvidence(null, shot.source),
      ballSpeedMph: roundShotEvidence(shot.metrics.ballSpeedMph, shot.source),
      launchAngleDeg: roundShotEvidence(shot.metrics.launchAngleDeg, shot.source),
      launchDirectionDeg: roundShotEvidence(shot.metrics.launchDirectionDeg, shot.source),
      spinRate: roundShotEvidence(shot.metrics.spinRate, shot.source),
      spinAxis: roundShotEvidence(shot.metrics.spinAxis, shot.source),
    },
    placementProvenance: "derived",
    trajectoryProvenance: "reconstructed",
    rollProvenance: shot.metrics.totalYd > shot.metrics.carryYd ? "reconstructed" : "unavailable",
  };
}

function roundShotEvidence(
  value: number | null,
  source: CourseTwinShotEventPayload["source"],
): CourseTwinEvidenceValue {
  return {
    value,
    provenance: value === null ? "unavailable" : source === "measured" ? "measured" : "derived",
  };
}

export function CourseTwinScene({
  manifest,
  replay,
  readOnly = false,
  tournamentId,
  tournamentRoundNumber,
}: {
  manifest: CourseTwinManifest;
  replay: CourseTwinReplayDocument | null;
  readOnly?: boolean;
  tournamentId?: string | null;
  tournamentRoundNumber?: number | null;
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
  const [strategyState, setStrategyState] = useState<StrategyLoadState>({
    holeNumber: null,
    status: "idle",
    document: null,
    error: null,
  });
  const [strategyClubId, setStrategyClubId] = useState<string | null>(null);
  const [virtualStart, setVirtualStart] = useState<CourseTwinPoint>(
    manifest.holes[0]?.tee ?? [0, 0, 0],
  );
  const [virtualShotNumber, setVirtualShotNumber] = useState(1);
  const [virtualStrokes, setVirtualStrokes] = useState(0);
  const [virtualPenaltyStrokes, setVirtualPenaltyStrokes] = useState(0);
  const [virtualAimDirectionDeg, setVirtualAimDirectionDeg] = useState(0);
  const [virtualShotKindChoice, setVirtualShotKindChoice] =
    useState<CourseTwinVirtualShotKind | null>(null);
  const [virtualShot, setVirtualShot] = useState<CourseTwinVirtualShot | null>(null);
  const [virtualComplete, setVirtualComplete] = useState(false);
  const [virtualRoundEventId, setVirtualRoundEventId] = useState<string | null>(null);
  const [virtualPuttAimDeg, setVirtualPuttAimDeg] = useState(0);
  const [virtualPuttPacePercent, setVirtualPuttPacePercent] = useState(100);
  const [virtualPuttNumber, setVirtualPuttNumber] = useState(1);
  const [virtualPuttResult, setVirtualPuttResult] = useState<CourseTwinPuttResult | null>(null);
  const [virtualPuttEventId, setVirtualPuttEventId] = useState<string | null>(null);
  const [bridgeState, setBridgeState] = useState<BridgeLoadState>({
    status: "idle",
    health: null,
    launchMonitorConnected: false,
    error: null,
  });
  const [pairingCode, setPairingCode] = useState("");
  const [liveStart, setLiveStart] = useState<CourseTwinPoint>(manifest.holes[0]?.tee ?? [0, 0, 0]);
  const [liveShotNumber, setLiveShotNumber] = useState(1);
  const [liveStrokes, setLiveStrokes] = useState(0);
  const [livePenaltyStrokes, setLivePenaltyStrokes] = useState(0);
  const [liveShot, setLiveShot] = useState<CourseTwinReplayShot | null>(null);
  const [liveComplete, setLiveComplete] = useState(false);
  const [liveHanded, setLiveHanded] = useState<"RH" | "LH">("RH");
  const [liveRoundEventId, setLiveRoundEventId] = useState<string | null>(null);
  const [roundRules, setRoundRules] = useState<CourseTwinRoundRules>(defaultRoundRules);
  const [roundHoleCount, setRoundHoleCount] = useState<9 | 18>(18);
  const [roundStartingHole, setRoundStartingHole] = useState<1 | 10>(1);
  const [activeRound, setActiveRound] = useState<CourseTwinRoundClientDocument | null>(null);
  const [roundSync, setRoundSync] = useState<RoundSyncState>({
    status: readOnly ? "idle" : "saving",
    error: null,
  });
  const [roundRetryToken, setRoundRetryToken] = useState(0);
  const [exploreTransport, setExploreTransport] = useState<ExploreTransport>("walk");
  const [explorePosition, setExplorePosition] = useState<CourseTwinPoint>(
    manifest.holes[0]?.tee ?? [0, 0, 0],
  );
  const [roomState, setRoomState] = useState<RoomLoadState>({
    status: "idle",
    room: null,
    error: null,
  });
  const [roomInviteCode, setRoomInviteCode] = useState("");
  const [roomJoinRole, setRoomJoinRole] = useState<"player" | "spectator">("player");
  const [roomCompetition, setRoomCompetition] = useState(false);
  const [roomVisibility, setRoomVisibility] = useState<"private" | "public">("private");
  const [publicRooms, setPublicRooms] = useState<PublicCourseTwinRoom[]>([]);
  const [publicRoomsLoading, setPublicRoomsLoading] = useState(false);
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const playbackRef = useRef(0);
  const modeRef = useRef(mode);
  const explorePresenceRef = useRef({
    transport: exploreTransport,
    position: explorePosition,
    holeNumber,
  });
  const cameraCommandIdRef = useRef(0);
  const strategyAbortRef = useRef<AbortController | null>(null);
  const bridgeClientRef = useRef<CourseTwinBridgeClient | null>(null);
  const activeRoundRef = useRef<CourseTwinRoundClientDocument | null>(null);
  const roomStateRef = useRef(roomState);
  const submittedRoundEventsRef = useRef(new Set<string>());
  const automaticGreenCompletionsRef = useRef(new Set<string>());
  const manualGreenCompletionsRef = useRef(new Set<string>());
  const liveContextRef = useRef({
    hole: manifest.holes[0],
    start: manifest.holes[0]?.tee ?? ([0, 0, 0] as CourseTwinPoint),
    clubType: "driver",
    shotNumber: 1,
    canAccept: false,
  });
  const terrainAsset = manifest.terrain.heightmap;

  const selectMode = (nextMode: RuntimeMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  };

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const selectedHole =
    manifest.holes.find((hole) => hole.holeNumber === holeNumber) ?? manifest.holes[0];
  const holeShots =
    replay?.shots.filter((shot) => shot.holeNumber === selectedHole.holeNumber) ?? [];
  const selectedShot = holeShots[Math.min(shotIndex, Math.max(0, holeShots.length - 1))] ?? null;
  const selectedHoleIndex = manifest.holes.findIndex(
    (hole) => hole.holeNumber === selectedHole.holeNumber,
  );
  const activeRoundPhysicalHoleNumber = activeRound
    ? courseTwinRoundPhysicalHoleNumber(activeRound, manifest.holes)
    : null;
  const activeRoundLedgerHoleNumber = activeRound?.currentHole ?? selectedHole.holeNumber;
  const roundLocksHole = activeRound?.status === "in_progress" && activeRound.mode === mode;
  const virtualPuttReplay = useMemo(
    () =>
      virtualPuttResult && virtualPuttEventId
        ? buildCourseTwinPuttReplay({
            id: virtualPuttEventId,
            holeNumber: activeRoundLedgerHoleNumber,
            puttNumber: virtualPuttNumber,
            result: virtualPuttResult,
          })
        : null,
    [activeRoundLedgerHoleNumber, virtualPuttEventId, virtualPuttNumber, virtualPuttResult],
  );

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    activeRoundRef.current = activeRound;
  }, [activeRound]);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    explorePresenceRef.current = {
      transport: exploreTransport,
      position: explorePosition,
      holeNumber,
    };
  }, [explorePosition, exploreTransport, holeNumber]);

  useEffect(() => {
    const roomId = roomState.room?.id;
    if (!roomId) return;
    let active = true;
    const refresh = async () => {
      const response = await fetch(`/api/course-twins/rooms/${roomId}`, { cache: "no-store" });
      if (!active) return;
      if (!response.ok) {
        setRoomState({ status: "error", room: null, error: "The group session has ended." });
        return;
      }
      setRoomState({ status: "ready", room: await response.json(), error: null });
    };
    const interval = window.setInterval(refresh, 4_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [roomState.room?.id]);

  useEffect(() => {
    const roomId = roomState.room?.id;
    if (!roomId || mode !== "explore") return;
    const publishPresence = () => {
      const presence = explorePresenceRef.current;
      void fetch(`/api/course-twins/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(presence),
      });
    };
    publishPresence();
    const interval = window.setInterval(publishPresence, 2_000);
    return () => window.clearInterval(interval);
  }, [mode, roomState.room?.id]);

  const animatedShot =
    mode === "replay"
      ? selectedShot
      : mode === "play"
        ? (virtualPuttReplay?.shot ?? virtualShot?.shot ?? null)
        : mode === "live"
          ? liveShot
          : null;

  useEffect(() => {
    if (!playing || !animatedShot) return;
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
  }, [animatedShot, playing]);

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
        ? createCourseTwinTerrainSampler(
            terrainAsset,
            terrainSamples,
            manifest.puttingSurfaces ?? [],
          )
        : null,
    [manifest.puttingSurfaces, terrainAsset, terrainSamples],
  );
  const classifySurface = useMemo(
    () => createCourseTwinSurfaceClassifier(manifest, selectedHole.holeNumber),
    [manifest, selectedHole.holeNumber],
  );
  const configuredWind = useMemo(
    () => courseTwinWindVector(activeRound?.rulesJson ?? roundRules),
    [activeRound?.rulesJson, roundRules],
  );
  const selectedSimulation = useMemo(
    () =>
      sampleTerrain && selectedShot
        ? simulateCourseTwinReplayShot(selectedShot, {
            groundHeight: sampleTerrain,
            surfaceAt: classifySurface,
          })
        : null,
    [classifySurface, sampleTerrain, selectedShot],
  );
  const virtualSimulation = useMemo(
    () =>
      sampleTerrain && virtualShot
        ? simulateCourseTwinReplayShot(
            virtualShot.shot,
            {
              groundHeight: sampleTerrain,
              surfaceAt: classifySurface,
            },
            { windMps: configuredWind },
          )
        : null,
    [classifySurface, configuredWind, sampleTerrain, virtualShot],
  );
  const liveSimulation = useMemo(
    () =>
      sampleTerrain && liveShot
        ? simulateCourseTwinReplayShot(
            liveShot,
            {
              groundHeight: sampleTerrain,
              surfaceAt: classifySurface,
            },
            { windMps: configuredWind },
          )
        : null,
    [classifySurface, configuredWind, liveShot, sampleTerrain],
  );
  const playbackFrame = useMemo(
    () => (selectedSimulation ? sampleCourseTwinSimulation(selectedSimulation, playback) : null),
    [playback, selectedSimulation],
  );
  const strategyClub = useMemo(
    () =>
      strategyState.document?.clubs.find((club) => club.clubId === strategyClubId) ??
      strategyState.document?.recommended ??
      null,
    [strategyClubId, strategyState.document],
  );
  const virtualRemainingYd =
    Math.hypot(selectedHole.green[0] - virtualStart[0], selectedHole.green[2] - virtualStart[2]) /
    0.9144;
  const virtualLieSurface = classifySurface(virtualStart[0], virtualStart[2]);
  const virtualShotKindOptions = courseTwinVirtualShotKindOptions(
    virtualRemainingYd,
    virtualLieSurface,
  );
  const virtualShotKind =
    virtualShotKindChoice && virtualShotKindOptions.includes(virtualShotKindChoice)
      ? virtualShotKindChoice
      : courseTwinVirtualShotKind(virtualRemainingYd, virtualLieSurface);
  const virtualAimDirection = courseTwinAimDirection(
    virtualStart,
    selectedHole.green,
    virtualAimDirectionDeg,
  );
  const virtualAimGuideDistanceM = THREE.MathUtils.clamp(virtualRemainingYd * 0.9144, 24, 165);
  const virtualAimTarget: CourseTwinPoint = [
    virtualStart[0] + virtualAimDirection.x * virtualAimGuideDistanceM,
    0,
    virtualStart[2] + virtualAimDirection.z * virtualAimGuideDistanceM,
  ];
  const virtualClubOptions = useMemo(
    () => courseTwinVirtualClubOptions(strategyState.document?.clubs ?? [], virtualRemainingYd),
    [strategyState.document?.clubs, virtualRemainingYd],
  );
  const virtualStrategyClub =
    virtualClubOptions.find((club) => club.clubId === strategyClubId) ??
    virtualClubOptions[0] ??
    strategyClub;
  const activeHoleShots =
    activeRound?.summary.acceptedShots
      .filter((shot) => shot.holeNumber === activeRoundLedgerHoleNumber)
      .sort((left, right) => left.shotNumber - right.shotNumber) ?? [];
  const activeHolePutts =
    activeRound?.summary.acceptedPutts
      .filter((putt) => putt.holeNumber === activeRoundLedgerHoleNumber)
      .sort((left, right) => left.puttNumber - right.puttNumber) ?? [];
  const activeRoundMode = activeRound?.mode;
  const acceptedRoundShots = activeRound?.summary.acceptedShots;
  const virtualCompletedTracers = useMemo(() => {
    if (!sampleTerrain || activeRoundMode !== "play" || !acceptedRoundShots) return [];
    const previousShot = acceptedRoundShots
      .filter(
        (shot) =>
          shot.holeNumber === activeRoundLedgerHoleNumber &&
          (!virtualShot || shot.clientEventId !== virtualRoundEventId),
      )
      .sort((left, right) => left.shotNumber - right.shotNumber)
      .slice(-1);
    return previousShot.flatMap((shot) => {
      const replayShot = roundShotPayloadToReplayShot(shot);
      const simulation = simulateCourseTwinReplayShot(
        replayShot,
        {
          groundHeight: sampleTerrain,
          surfaceAt: classifySurface,
        },
        { windMps: configuredWind },
      );
      if (!courseTwinGroundPositionsCoincide(simulation.finalPosition, virtualStart)) return [];
      return {
        id: shot.clientEventId,
        simulation,
      };
    });
  }, [
    acceptedRoundShots,
    activeRoundMode,
    classifySurface,
    configuredWind,
    sampleTerrain,
    activeRoundLedgerHoleNumber,
    virtualRoundEventId,
    virtualShot,
    virtualStart,
  ]);
  const latestActiveShot = activeHoleShots.at(-1) ?? null;
  const latestActivePutt = activeHolePutts.at(-1) ?? null;
  const manualPuttingActive =
    activeRound?.mode === "play" &&
    activeRound.status === "in_progress" &&
    activeRound.rulesJson.greenRule === "manual_putts" &&
    latestActiveShot?.result.finalSurface === "green" &&
    !latestActiveShot.result.penalty &&
    !latestActivePutt?.holed;
  const manualPuttingVisible =
    activeRound?.mode === "play" &&
    activeRound.status === "in_progress" &&
    activeRound.rulesJson.greenRule === "manual_putts" &&
    latestActiveShot?.result.finalSurface === "green" &&
    !latestActiveShot.result.penalty &&
    (manualPuttingActive || Boolean(virtualPuttResult));
  const virtualPuttStart = latestActivePutt?.end ?? latestActiveShot?.totalEnd ?? null;
  const automaticGreenCompletion = useMemo(
    () =>
      activeRound && activeRound.rulesJson.greenRule !== "manual_putts"
        ? buildCourseTwinAutomaticGreenCompletion({
            summary: activeRound.summary,
            hole: { ...selectedHole, holeNumber: activeRound.currentHole },
          })
        : null,
    [activeRound, selectedHole],
  );
  const manualGreenCompletion = useMemo(
    () =>
      activeRound?.rulesJson.greenRule === "manual_putts"
        ? buildCourseTwinManualGreenCompletion({
            summary: activeRound.summary,
            hole: { ...selectedHole, holeNumber: activeRound.currentHole },
          })
        : null,
    [activeRound, selectedHole],
  );

  const appendRoundEvent = useCallback(
    async (event: CourseTwinRoundEventInput) => {
      const current = activeRoundRef.current;
      if (!current) throw new Error("Start a Course Twin round before saving shots.");
      setRoundSync({ status: "saving", error: null });
      try {
        const updated = await appendCourseTwinRoundEventClient(current, event);
        activeRoundRef.current = updated;
        setActiveRound(updated);
        setRoundSync({ status: "ready", error: null });
        if (event.type === "round.completed" && tournamentId && updated.sessionId) {
          const submission = await fetch(`/api/course-twins/rounds/${updated.id}/tournament`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tournamentId,
              roundNumber: tournamentRoundNumber ?? 1,
            }),
          });
          if (!submission.ok) {
            const body = (await submission.json()) as { error?: string };
            setRoundSync({
              status: "error",
              error: `Round saved, but tournament submission needs attention: ${body.error ?? "submission failed"}`,
            });
          }
        }
        const sharedRoom = roomStateRef.current.room;
        if (sharedRoom && sharedRoom.currentRole !== "spectator" && !sharedRoom.finalEventHash) {
          void fetch(`/api/course-twins/rooms/${sharedRoom.id}/shared-round/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expectedVersion: sharedRoom.sharedRoundVersion, event }),
          })
            .then(async (response) => {
              if (response.ok) {
                const body = (await response.json()) as { room?: CourseTwinRoomClient };
                if (body.room) {
                  const next = { status: "ready", room: body.room, error: null } as const;
                  roomStateRef.current = next;
                  setRoomState(next);
                }
                return;
              }
              if (response.status === 409) {
                const refreshed = await fetch(`/api/course-twins/rooms/${sharedRoom.id}`, {
                  cache: "no-store",
                });
                if (refreshed.ok) {
                  const next = {
                    status: "ready",
                    room: (await refreshed.json()) as CourseTwinRoomClient,
                    error: null,
                  } as const;
                  roomStateRef.current = next;
                  setRoomState(next);
                }
              }
            })
            .catch(() => {
              // The personal round is canonical locally; room polling retries shared visibility.
            });
        }
        return updated;
      } catch (error) {
        if (error instanceof CourseTwinRoundRequestError && error.status === 409) {
          try {
            const canonical = await loadCourseTwinRoundClient(current.id);
            activeRoundRef.current = canonical;
            setActiveRound(canonical);
            setRoundSync({ status: "ready", error: null });
            return canonical;
          } catch (refreshError) {
            setRoundSync({
              status: "error",
              error:
                refreshError instanceof Error
                  ? refreshError.message
                  : "Course Twin could not refresh the round.",
            });
            throw refreshError;
          }
        }
        setRoundSync({
          status: "error",
          error: error instanceof Error ? error.message : "Course Twin could not save the round.",
        });
        throw error;
      }
    },
    [tournamentId, tournamentRoundNumber],
  );

  useEffect(() => {
    if (
      activeRound?.mode !== "play" ||
      !virtualRoundEventId ||
      !virtualShot ||
      !virtualSimulation ||
      !strategyClub ||
      submittedRoundEventsRef.current.has(virtualRoundEventId)
    ) {
      return;
    }
    submittedRoundEventsRef.current.add(virtualRoundEventId);
    void appendRoundEvent({
      type: "shot.accepted",
      clientEventId: virtualRoundEventId,
      payload: buildRoundShotPayload({
        shot: virtualShot.shot,
        simulation: virtualSimulation,
        clubId: strategyClub.clubId,
        source: "modelled",
        ledgerHoleNumber: activeRound.currentHole,
      }),
    }).catch(() => submittedRoundEventsRef.current.delete(virtualRoundEventId));
  }, [
    activeRound?.currentHole,
    activeRound?.mode,
    appendRoundEvent,
    roundRetryToken,
    strategyClub,
    virtualRoundEventId,
    virtualShot,
    virtualSimulation,
  ]);

  useEffect(() => {
    if (
      activeRound?.mode !== "live" ||
      !liveRoundEventId ||
      !liveShot ||
      !liveSimulation ||
      !strategyClub ||
      submittedRoundEventsRef.current.has(liveRoundEventId)
    ) {
      return;
    }
    submittedRoundEventsRef.current.add(liveRoundEventId);
    void appendRoundEvent({
      type: "shot.accepted",
      clientEventId: liveRoundEventId,
      payload: buildRoundShotPayload({
        shot: liveShot,
        simulation: liveSimulation,
        clubId: strategyClub.clubId,
        source: "measured",
        ledgerHoleNumber: activeRound.currentHole,
      }),
    }).catch(() => submittedRoundEventsRef.current.delete(liveRoundEventId));
  }, [
    activeRound?.currentHole,
    activeRound?.mode,
    appendRoundEvent,
    liveRoundEventId,
    liveShot,
    liveSimulation,
    roundRetryToken,
    strategyClub,
  ]);

  useEffect(() => {
    if (
      activeRound?.mode !== "play" ||
      activeRound.rulesJson.greenRule !== "manual_putts" ||
      !virtualPuttEventId ||
      !virtualPuttResult ||
      submittedRoundEventsRef.current.has(virtualPuttEventId)
    ) {
      return;
    }
    submittedRoundEventsRef.current.add(virtualPuttEventId);
    void appendRoundEvent({
      type: "putt.accepted",
      clientEventId: virtualPuttEventId,
      payload: buildCourseTwinPuttEventPayload({
        holeNumber: activeRound.currentHole,
        puttNumber: virtualPuttNumber,
        result: virtualPuttResult,
      }),
    }).catch(() => submittedRoundEventsRef.current.delete(virtualPuttEventId));
  }, [
    activeRound?.mode,
    activeRound?.rulesJson.greenRule,
    appendRoundEvent,
    roundRetryToken,
    activeRound?.currentHole,
    virtualPuttEventId,
    virtualPuttNumber,
    virtualPuttResult,
  ]);

  useEffect(() => {
    liveContextRef.current = {
      hole: selectedHole,
      start: liveStart,
      clubType: strategyClub?.clubType ?? "driver",
      shotNumber: liveShotNumber,
      canAccept:
        activeRound?.mode === "live" &&
        activeRound.status === "in_progress" &&
        activeRoundPhysicalHoleNumber === selectedHole.holeNumber &&
        !liveShot &&
        !liveComplete,
    };
  }, [
    activeRound?.mode,
    activeRound?.status,
    activeRoundPhysicalHoleNumber,
    liveComplete,
    liveShot,
    liveShotNumber,
    liveStart,
    selectedHole,
    strategyClub,
  ]);

  useEffect(
    () => () => {
      bridgeClientRef.current?.disconnect();
      bridgeClientRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (bridgeState.status !== "connected" || !strategyClub) return;
    bridgeClientRef.current?.sendPlayer(liveHanded, strategyClub.clubType);
  }, [bridgeState.status, liveHanded, strategyClub]);

  useEffect(() => () => strategyAbortRef.current?.abort(), []);

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
        roundLedger: activeRound
          ? {
              id: activeRound.id,
              mode: activeRound.mode,
              status: activeRound.status,
              version: activeRound.version,
              currentHole: activeRound.currentHole,
              holeCount: activeRound.holeCount,
              sessionId: activeRound.sessionId,
              finalEventHash: activeRound.finalEventHash,
              scorecard: activeRound.summary.scorecard,
              sync: roundSync.status,
              rules: activeRound.rulesJson,
            }
          : {
              status: "not_started",
              sync: roundSync.status,
              rules: roundRules,
            },
        mode,
        cameraView,
        cameraCommand: cameraCommand?.action ?? null,
        hole: selectedHole.holeNumber,
        automaticPutting: automaticGreenCompletion
          ? {
              status: roundSync.status === "saving" ? "saving" : "pending",
              putts: automaticGreenCompletion.payload.putts,
              remainingYd: Number(automaticGreenCompletion.remainingYd.toFixed(1)),
              triggerShotClientEventId: automaticGreenCompletion.triggerShotClientEventId,
            }
          : null,
        manualPutting:
          mode === "play" && manualPuttingVisible && virtualPuttStart
            ? {
                status: virtualPuttResult
                  ? playback < 1
                    ? "rolling"
                    : virtualPuttResult.holed
                      ? "holed"
                      : "awaiting-next-putt"
                  : "ready",
                puttNumber: virtualPuttNumber,
                start: virtualPuttStart,
                pin: selectedHole.green,
                aimOffsetDeg: virtualPuttAimDeg,
                pacePercent: virtualPuttPacePercent,
                result: virtualPuttResult
                  ? {
                      holed: virtualPuttResult.holed,
                      remainingDistanceM: Number(virtualPuttResult.remainingDistanceM.toFixed(2)),
                      finalPosition: virtualPuttResult.finalPosition,
                      provenance: virtualPuttResult.provenance,
                    }
                  : null,
              }
            : null,
        visibleShotCount:
          mode === "replay" && selectedShot
            ? 1
            : mode === "play"
              ? virtualCompletedTracers.length + (virtualShot ? 1 : 0)
              : 0,
        selectedShotIndex: mode === "replay" && selectedShot ? shotIndex : null,
        shot:
          mode === "replay" && selectedShot
            ? {
                id: selectedShot.id,
                club: selectedShot.clubType,
                playback: Number(playback.toFixed(3)),
                start: selectedShot.start,
                totalEnd: selectedShot.totalEnd,
                physics: selectedSimulation
                  ? {
                      phase: playbackFrame?.phase ?? "stopped",
                      position: playbackFrame?.position ?? selectedSimulation.finalPosition,
                      landingSurface: selectedSimulation.landingSurface,
                      finalSurface: selectedSimulation.finalSurface,
                      penalty: selectedSimulation.penalty,
                      bounceCount: selectedSimulation.bounceCount,
                      flightTimeS: Number(selectedSimulation.flightTimeS.toFixed(2)),
                      totalTimeS: Number(selectedSimulation.totalTimeS.toFixed(2)),
                    }
                  : null,
              }
            : null,
        strategy:
          mode === "strategy"
            ? {
                status: strategyState.status,
                holeNumber: strategyState.holeNumber,
                selectedClub: strategyClub
                  ? {
                      id: strategyClub.clubId,
                      club: strategyClub.clubType,
                      carryMedianYd: strategyClub.carryMedianYd,
                      aimOffsetYd: strategyClub.aimOffsetYd,
                      averageRemainingYd: strategyClub.averageRemainingYd,
                      expectedRiskStrokes: strategyClub.expectedRiskStrokes,
                      probabilities: strategyClub.probabilities,
                      landingPoints: strategyClub.landingCloud.length,
                    }
                  : null,
              }
            : null,
        virtualRound:
          mode === "play"
            ? {
                holeNumber: activeRoundLedgerHoleNumber,
                physicalHoleNumber: selectedHole.holeNumber,
                shotNumber: virtualShotNumber,
                strokes: virtualStrokes,
                penaltyStrokes: virtualPenaltyStrokes,
                complete: virtualComplete,
                aimDirectionDeg: virtualAimDirectionDeg,
                start: virtualStart,
                club: virtualStrategyClub?.clubType ?? null,
                remainingYd: Number(virtualRemainingYd.toFixed(1)),
                lieSurface: virtualLieSurface,
                shotKind: virtualShotKind,
                shotKindOptions: virtualShotKindOptions,
                availableClubs: virtualClubOptions.map((club) => club.clubType),
                completedTracerCount: virtualCompletedTracers.length,
                nextShotStart: virtualShot ? null : virtualStart,
                sampledShot: virtualShot?.sampled ?? null,
                physics: virtualSimulation
                  ? {
                      finalPosition: virtualSimulation.finalPosition,
                      finalSurface: virtualSimulation.finalSurface,
                      penalty: virtualSimulation.penalty,
                    }
                  : null,
              }
            : null,
        liveRound:
          mode === "live"
            ? {
                bridgeStatus: bridgeState.status,
                launchMonitorConnected: bridgeState.launchMonitorConnected,
                holeNumber: activeRoundLedgerHoleNumber,
                physicalHoleNumber: selectedHole.holeNumber,
                shotNumber: liveShotNumber,
                strokes: liveStrokes,
                penaltyStrokes: livePenaltyStrokes,
                complete: liveComplete,
                start: liveStart,
                club: strategyClub?.clubType ?? null,
                shot: liveShot
                  ? {
                      id: liveShot.id,
                      ballSpeedMph: liveShot.metrics.ballSpeedMph.value,
                      launchAngleDeg: liveShot.metrics.launchAngleDeg.value,
                      spinRate: liveShot.metrics.spinRate.value,
                      carryYd: liveShot.metrics.carryYd.value,
                    }
                  : null,
                physics: liveSimulation
                  ? {
                      finalPosition: liveSimulation.finalPosition,
                      finalSurface: liveSimulation.finalSurface,
                      penalty: liveSimulation.penalty,
                    }
                  : null,
              }
            : null,
        exploration:
          mode === "explore"
            ? {
                transport: exploreTransport,
                position: explorePosition,
                controls:
                  exploreTransport === "walk"
                    ? "W/S move, A/D strafe, arrow keys turn"
                    : "W/S drive, A/D or arrow keys steer",
                groupSession:
                  roomState.status === "ready" && roomState.room
                    ? {
                        roomId: roomState.room.id,
                        inviteCode: roomState.room.inviteCode,
                        memberCount: roomState.room.members.length,
                        isHost: roomState.room.isHost,
                        role: roomState.room.currentRole,
                        competition: roomState.room.competition,
                        visibility: roomState.room.visibility,
                        sharedRoundVersion: roomState.room.sharedRoundVersion,
                        sharedEventCount: roomState.room.sharedEventCount,
                        finalEventHash: roomState.room.finalEventHash,
                      }
                    : { status: roomState.status, error: roomState.error },
              }
            : null,
      });
    gameWindow.advanceTime = (milliseconds) => {
      setPlaying(false);
      setPlayback((current) => Math.min(1, current + Math.max(0, milliseconds) / 3200));
      window.dispatchEvent(
        new CustomEvent("course-twin-advance-time", {
          detail: Math.max(0, milliseconds),
        }),
      );
    };
    return () => {
      delete gameWindow.render_game_to_text;
      delete gameWindow.advanceTime;
    };
  }, [
    activeRound,
    activeRoundLedgerHoleNumber,
    automaticGreenCompletion,
    cameraCommand,
    cameraView,
    explorePosition,
    exploreTransport,
    bridgeState.launchMonitorConnected,
    bridgeState.status,
    liveComplete,
    livePenaltyStrokes,
    liveShot,
    liveShotNumber,
    liveSimulation,
    liveStart,
    liveStrokes,
    manualPuttingVisible,
    manifest,
    mode,
    playback,
    playbackFrame,
    roomState,
    roundRules,
    roundSync.status,
    sampleTerrain,
    selectedHole,
    selectedShot,
    selectedSimulation,
    shotIndex,
    strategyClub,
    strategyState.holeNumber,
    strategyState.status,
    terrainError,
    virtualAimDirectionDeg,
    virtualComplete,
    virtualPenaltyStrokes,
    virtualPuttAimDeg,
    virtualPuttNumber,
    virtualPuttPacePercent,
    virtualPuttResult,
    virtualPuttStart,
    virtualShot,
    virtualShotKind,
    virtualShotKindOptions,
    virtualShotNumber,
    virtualSimulation,
    virtualStart,
    virtualStrategyClub,
    virtualStrokes,
    virtualClubOptions,
    virtualCompletedTracers,
    virtualLieSurface,
    virtualRemainingYd,
  ]);

  const ensureBridgeClient = () => {
    if (bridgeClientRef.current) return bridgeClientRef.current;
    const client = new CourseTwinBridgeClient({
      onEvent: (event: CourseTwinBridgeEvent) => {
        if (event.type === "bridge-status") {
          setBridgeState((current) => ({
            ...current,
            status: "connected",
            launchMonitorConnected: event.launchMonitorConnected,
            error: null,
          }));
          return;
        }
        if (event.type === "launch-monitor-status") {
          setBridgeState((current) => ({
            ...current,
            launchMonitorConnected: event.connected,
          }));
          return;
        }

        const context = liveContextRef.current;
        if (!context.hole || !context.canAccept) {
          setBridgeState((current) => ({
            ...current,
            error: activeRoundRef.current
              ? "Finish the current shot before hitting another ball."
              : "Start a Live Course Twin round before hitting a ball.",
          }));
          return;
        }
        setLiveRoundEventId(crypto.randomUUID());
        setLiveShot(
          bridgeShotToReplayShot({
            event,
            hole: context.hole,
            start: context.start,
            clubType: context.clubType,
            holeShotNumber: context.shotNumber,
          }),
        );
        setLiveStrokes((current) => current + 1);
        setBridgeState((current) => ({
          ...current,
          launchMonitorConnected: true,
          error: null,
        }));
        setMode("live");
        setCameraView("golfer");
        setPlayback(0);
        setPlaying(true);
        setCameraCommand(null);
      },
      onDisconnect: (reason) => {
        setBridgeState((current) => ({
          ...current,
          status: "error",
          launchMonitorConnected: false,
          error: reason,
        }));
      },
    });
    bridgeClientRef.current = client;
    return client;
  };

  const detectBridge = () => {
    const client = ensureBridgeClient();
    setBridgeState((current) => ({ ...current, status: "detecting", error: null }));
    void client
      .detect()
      .then((health) => {
        setBridgeState({
          status: "available",
          health,
          launchMonitorConnected: health.gsProConnected,
          error: null,
        });
      })
      .catch(() => {
        setBridgeState({
          status: "error",
          health: null,
          launchMonitorConnected: false,
          error: "Start the Course Twin Bridge on this computer, then try again.",
        });
      });
  };

  const pairBridge = () => {
    if (!/^\d{6}$/.test(pairingCode)) {
      setBridgeState((current) => ({
        ...current,
        error: "Enter the six-digit code shown in the bridge window.",
      }));
      return;
    }
    const client = ensureBridgeClient();
    setBridgeState((current) => ({ ...current, status: "pairing", error: null }));
    void client
      .pair(pairingCode)
      .then(() => {
        setPairingCode("");
        setBridgeState((current) => ({ ...current, status: "connected", error: null }));
        if (strategyClub) client.sendPlayer(liveHanded, strategyClub.clubType);
      })
      .catch((error: unknown) => {
        setBridgeState((current) => ({
          ...current,
          status: "available",
          error: error instanceof Error ? error.message : "Course Twin could not pair.",
        }));
      });
  };

  const downloadBridgeDiagnostics = () => {
    void ensureBridgeClient()
      .diagnostics()
      .then((report) => {
        const url = URL.createObjectURL(
          new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `course-twin-bridge-${report.capturedAt.slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => {
        setBridgeState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : "Bridge diagnostics are unavailable.",
        }));
      });
  };

  const loadStrategy = (nextHoleNumber: number) => {
    strategyAbortRef.current?.abort();
    const controller = new AbortController();
    strategyAbortRef.current = controller;
    setStrategyState({
      holeNumber: nextHoleNumber,
      status: "loading",
      document: null,
      error: null,
    });
    void fetch(
      `/api/course-twins/${encodeURIComponent(manifest.course.id)}/strategy?holeNumber=${nextHoleNumber}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json()) as CourseTwinStrategyDocument | { error?: unknown };
        if (!response.ok || !("modelVersion" in body)) {
          throw new Error(
            "error" in body && typeof body.error === "string"
              ? body.error
              : "Course strategy is unavailable.",
          );
        }
        return body;
      })
      .then((document) => {
        if (controller.signal.aborted) return;
        setStrategyState({
          holeNumber: nextHoleNumber,
          status: "ready",
          document,
          error: null,
        });
        setStrategyClubId(document.recommended?.clubId ?? document.clubs[0]?.clubId ?? null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStrategyState({
          holeNumber: nextHoleNumber,
          status: "error",
          document: null,
          error: error instanceof Error ? error.message : "Course strategy is unavailable.",
        });
      });
  };

  const selectHole = (nextHoleNumber: number) => {
    setHoleNumber(nextHoleNumber);
    setShotIndex(0);
    setPlayback(0);
    setPlaying(false);
    setCameraCommand(null);
    const nextHole = manifest.holes.find((hole) => hole.holeNumber === nextHoleNumber);
    if (nextHole) {
      setVirtualStart(nextHole.tee);
      setVirtualShotNumber(1);
      setVirtualStrokes(0);
      setVirtualPenaltyStrokes(0);
      setVirtualAimDirectionDeg(0);
      setVirtualShotKindChoice(null);
      setVirtualShot(null);
      setVirtualComplete(false);
      setVirtualRoundEventId(null);
      setVirtualPuttAimDeg(0);
      setVirtualPuttPacePercent(100);
      setVirtualPuttNumber(1);
      setVirtualPuttResult(null);
      setVirtualPuttEventId(null);
      setLiveStart(nextHole.tee);
      setLiveShotNumber(1);
      setLiveStrokes(0);
      setLivePenaltyStrokes(0);
      setLiveShot(null);
      setLiveComplete(false);
      setLiveRoundEventId(null);
      setExplorePosition(nextHole.tee);
    }
    if (mode === "strategy") loadStrategy(nextHoleNumber);
    if (mode === "play") loadStrategy(nextHoleNumber);
    if (mode === "live") loadStrategy(nextHoleNumber);
  };

  const restorePersistedRoundHole = (round: CourseTwinRoundClientDocument) => {
    const restored = courseTwinRoundHoleResumeState(round, manifest.holes);
    if (!restored) {
      setRoundSync({
        status: "error",
        error: `Hole ${round.currentHole} is unavailable in this Course Twin package.`,
      });
      return false;
    }

    setHoleNumber(restored.physicalHoleNumber);
    setShotIndex(0);
    setPlayback(0);
    setPlaying(false);
    setCameraView("golfer");
    setCameraCommand(null);
    setExplorePosition(restored.start);
    if (round.mode === "play") {
      setVirtualStart(restored.start);
      setVirtualShotNumber(restored.shotNumber);
      setVirtualStrokes(restored.strokes);
      setVirtualPenaltyStrokes(restored.penaltyStrokes);
      setVirtualAimDirectionDeg(0);
      setVirtualShotKindChoice(null);
      setVirtualShot(null);
      setVirtualComplete(false);
      setVirtualRoundEventId(null);
      setVirtualPuttAimDeg(0);
      setVirtualPuttPacePercent(100);
      setVirtualPuttNumber(restored.puttNumber);
      setVirtualPuttResult(null);
      setVirtualPuttEventId(null);
    } else {
      setLiveStart(restored.start);
      setLiveShotNumber(restored.shotNumber);
      setLiveStrokes(restored.strokes);
      setLivePenaltyStrokes(restored.penaltyStrokes);
      setLiveShot(null);
      setLiveComplete(false);
      setLiveRoundEventId(null);
    }
    loadStrategy(restored.physicalHoleNumber);
    setRoundSync({ status: "ready", error: null });
    return true;
  };

  useEffect(() => {
    if (readOnly) {
      activeRoundRef.current = null;
      return;
    }
    let mounted = true;
    const modeAtLoad = modeRef.current;
    void loadActiveCourseTwinRoundClient(manifest.course.id)
      .then((round) => {
        if (!mounted) return;
        if (!round) {
          setRoundSync({ status: "idle", error: null });
          return;
        }
        activeRoundRef.current = round;
        setActiveRound(round);
        setRoundRules(round.rulesJson);
        setRoundHoleCount(round.holeCount === 9 ? 9 : 18);
        setRoundStartingHole(round.startingHole === 10 ? 10 : 1);
        if (modeRef.current === modeAtLoad) {
          modeRef.current = round.mode;
          setMode(round.mode);
        }
        restorePersistedRoundHole(round);
      })
      .catch((error) => {
        if (!mounted) return;
        setRoundSync({
          status: "error",
          error: error instanceof Error ? error.message : "Course Twin could not resume the round.",
        });
      });
    return () => {
      mounted = false;
    };
    // Resume is intentionally scoped to the published course identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.course.id, readOnly]);

  useEffect(() => {
    const rejectedWrongHoleShot =
      roundSync.status === "error" && roundSync.error === "Shot is not on the current hole.";
    if (
      readOnly ||
      !activeRound ||
      activeRound.status !== "in_progress" ||
      activeRound.mode !== mode ||
      (activeRoundPhysicalHoleNumber === selectedHole.holeNumber && !rejectedWrongHoleShot)
    ) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) restorePersistedRoundHole(activeRound);
    });
    return () => {
      cancelled = true;
    };
    // The canonical ledger must win whenever the golfer returns to its active Play/Live mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeRound?.currentHole,
    activeRound?.id,
    activeRound?.mode,
    activeRound?.status,
    activeRound?.version,
    activeRoundPhysicalHoleNumber,
    mode,
    readOnly,
    roundSync.error,
    roundSync.status,
    selectedHole.holeNumber,
  ]);

  const startPersistedRound = async (roundMode: "play" | "live") => {
    if (activeRound?.status === "in_progress") {
      setRoundSync({ status: "error", error: "Finish or abandon the active round first." });
      return;
    }
    setRoundSync({ status: "saving", error: null });
    try {
      const startingHole = roundHoleCount === 18 ? 1 : roundStartingHole;
      const rules =
        roundMode === "live" && roundRules.greenRule === "manual_putts"
          ? { ...roundRules, greenRule: "automatic_putts" as const }
          : roundRules;
      const round = await createCourseTwinRoundClient(manifest.course.id, {
        mode: roundMode,
        holeCount: roundHoleCount,
        startingHole,
        rules,
      });
      activeRoundRef.current = round;
      setActiveRound(round);
      submittedRoundEventsRef.current.clear();
      setRoundSync({ status: "ready", error: null });
      setMode(roundMode);
      selectHole(startingHole);
    } catch (error) {
      setRoundSync({
        status: "error",
        error: error instanceof Error ? error.message : "Course Twin could not start the round.",
      });
    }
  };

  const finishPersistedHole = async ({
    roundMode,
    completion,
  }: {
    roundMode: "play" | "live";
    completion: { payload: CourseTwinHoleCompletedPayload };
  }) => {
    const current = activeRoundRef.current;
    if (!current || current.mode !== roundMode || roundSync.status === "saving") return false;
    try {
      const afterHole = await appendRoundEvent({
        type: "hole.completed",
        clientEventId: crypto.randomUUID(),
        payload: completion.payload,
      });
      const roundFinished = afterHole.summary.scorecard.length === afterHole.holeCount;
      if (roundFinished) {
        const completed = await appendRoundEvent({
          type: "round.completed",
          clientEventId: crypto.randomUUID(),
          payload: {},
        });
        if (roundMode === "play") {
          setVirtualStrokes(completion.payload.strokes);
          setVirtualComplete(true);
        } else {
          setLiveStrokes(completion.payload.strokes);
          setLiveComplete(true);
        }
        activeRoundRef.current = completed;
        setActiveRound(completed);
      } else {
        selectHole(afterHole.currentHole);
      }
      setPlaying(false);
      return true;
    } catch {
      // appendRoundEvent owns the golfer-facing error state.
      return false;
    }
  };

  useEffect(() => {
    const completion = automaticGreenCompletion;
    const round = activeRoundRef.current;
    if (!completion || !round || roundSync.status === "saving") return;
    if (automaticGreenCompletionsRef.current.has(completion.triggerShotClientEventId)) return;

    const transientShotIsVisible =
      round.mode === "play"
        ? virtualRoundEventId === completion.triggerShotClientEventId && Boolean(virtualShot)
        : liveRoundEventId === completion.triggerShotClientEventId && Boolean(liveShot);
    if (transientShotIsVisible && playback < 1) return;

    automaticGreenCompletionsRef.current.add(completion.triggerShotClientEventId);
    void finishPersistedHole({ roundMode: round.mode, completion }).then((saved) => {
      if (!saved) {
        automaticGreenCompletionsRef.current.delete(completion.triggerShotClientEventId);
      }
    });
    // finishPersistedHole intentionally reads the latest active-round ref and ledger sync state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    automaticGreenCompletion,
    liveRoundEventId,
    liveShot,
    playback,
    roundRetryToken,
    roundSync.status,
    virtualRoundEventId,
    virtualShot,
  ]);

  useEffect(() => {
    const completion = manualGreenCompletion;
    const round = activeRoundRef.current;
    if (!completion || !round || round.mode !== "play" || roundSync.status === "saving") return;
    if (manualGreenCompletionsRef.current.has(completion.triggerPuttClientEventId)) return;
    const transientPuttIsVisible =
      virtualPuttEventId === completion.triggerPuttClientEventId && Boolean(virtualPuttResult);
    if (transientPuttIsVisible && playback < 1) return;

    manualGreenCompletionsRef.current.add(completion.triggerPuttClientEventId);
    queueMicrotask(() => {
      void finishPersistedHole({ roundMode: "play", completion }).then((saved) => {
        if (!saved) {
          manualGreenCompletionsRef.current.delete(completion.triggerPuttClientEventId);
        }
      });
    });
    // finishPersistedHole intentionally reads the latest active-round ref and ledger sync state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manualGreenCompletion,
    playback,
    roundRetryToken,
    roundSync.status,
    virtualPuttEventId,
    virtualPuttResult,
  ]);

  const takePersistedMulligan = async (roundMode: "play" | "live", shotClientEventId: string) => {
    const current = activeRoundRef.current;
    if (!current || current.mode !== roundMode || roundSync.status === "saving") return;
    try {
      await appendRoundEvent({
        type: "shot.mulligan",
        clientEventId: crypto.randomUUID(),
        payload: { shotClientEventId, reason: "Golfer selected mulligan" },
      });
      if (roundMode === "play") {
        setVirtualStrokes((value) => Math.max(0, value - 1));
        setVirtualShot(null);
        setVirtualRoundEventId(null);
      } else {
        setLiveStrokes((value) => Math.max(0, value - 1));
        setLiveShot(null);
        setLiveRoundEventId(null);
      }
      setPlayback(0);
      setPlaying(false);
      setCameraCommand(null);
    } catch {
      // appendRoundEvent owns the golfer-facing error state.
    }
  };

  const issueCameraCommand = (action: CameraControlAction) => {
    cameraCommandIdRef.current += 1;
    setCameraCommand({ id: cameraCommandIdRef.current, action });
  };

  const createRoom = async () => {
    setRoomState({ status: "loading", room: null, error: null });
    try {
      const response = await fetch(`/api/course-twins/${manifest.course.id}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: roomCompetition ? "play" : "explore",
          maxPlayers: 4,
          spectatorLimit: 8,
          holeNumber,
          competition: roomCompetition,
          visibility: roomVisibility,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to start a group session.");
      setRoomState({ status: "ready", room: body, error: null });
      if (roomCompetition) {
        setRoundRules((current) => ({
          ...current,
          competition: true,
          mulligansAllowed: false,
          greenRule: "competition_gimmes",
        }));
      }
    } catch (error) {
      setRoomState({
        status: "error",
        room: null,
        error: error instanceof Error ? error.message : "Unable to start a group session.",
      });
    }
  };

  const joinRoom = async () => {
    setRoomState({ status: "loading", room: null, error: null });
    try {
      const response = await fetch("/api/course-twins/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: roomInviteCode, role: roomJoinRole }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to join that group session.");
      setRoomState({ status: "ready", room: body, error: null });
    } catch (error) {
      setRoomState({
        status: "error",
        room: null,
        error: error instanceof Error ? error.message : "Unable to join that group session.",
      });
    }
  };

  const joinPublicRoom = async (inviteCode: string) => {
    setRoomState({ status: "loading", room: null, error: null });
    try {
      const response = await fetch("/api/course-twins/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, role: roomJoinRole }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to join that public room.");
      setRoomState({ status: "ready", room: body, error: null });
    } catch (error) {
      setRoomState({
        status: "error",
        room: null,
        error: error instanceof Error ? error.message : "Unable to join that public room.",
      });
    }
  };

  const loadPublicRooms = async () => {
    setPublicRoomsLoading(true);
    try {
      const response = await fetch(`/api/course-twins/${manifest.course.id}/rooms/public`, {
        cache: "no-store",
      });
      const body = (await response.json()) as { rooms?: PublicCourseTwinRoom[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Public rooms could not be loaded.");
      setPublicRooms(body.rooms ?? []);
    } catch (error) {
      setRoomState({
        status: "error",
        room: null,
        error: error instanceof Error ? error.message : "Public rooms could not be loaded.",
      });
    } finally {
      setPublicRoomsLoading(false);
    }
  };

  const leaveRoom = async () => {
    if (roomState.room) {
      await fetch(`/api/course-twins/rooms/${roomState.room.id}`, { method: "DELETE" });
    }
    setRoomState({ status: "idle", room: null, error: null });
    setRoomInviteCode("");
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
            reference imagery.{" "}
            {manifest.quality.verified
              ? "Putting contours are backed by reviewed high-resolution green surveys."
              : "Green contours remain unverified for putting."}
          </p>
        </div>

        <div
          className={cn(
            "mt-5 grid gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1",
            readOnly ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-6",
          )}
        >
          <ModeButton
            active={mode === "flyover"}
            onClick={() => {
              selectMode("flyover");
              setCameraCommand(null);
            }}
          >
            Flyover
          </ModeButton>
          <ModeButton
            active={mode === "replay"}
            disabled={!replay?.shots.length}
            onClick={() => {
              selectMode("replay");
              setCameraView("golfer");
              setCameraCommand(null);
            }}
          >
            Replay
          </ModeButton>
          {!readOnly ? (
            <>
              <ModeButton
                active={mode === "strategy"}
                onClick={() => {
                  selectMode("strategy");
                  setCameraView("aerial");
                  setCameraCommand(null);
                  if (
                    strategyState.holeNumber !== selectedHole.holeNumber ||
                    strategyState.status === "idle" ||
                    strategyState.status === "error"
                  ) {
                    loadStrategy(selectedHole.holeNumber);
                  }
                }}
              >
                Strategy
              </ModeButton>
              <ModeButton
                active={mode === "play"}
                onClick={() => {
                  selectMode("play");
                  setCameraView("golfer");
                  setCameraCommand(null);
                  if (
                    strategyState.holeNumber !== selectedHole.holeNumber ||
                    strategyState.status === "idle" ||
                    strategyState.status === "error"
                  ) {
                    loadStrategy(selectedHole.holeNumber);
                  }
                }}
              >
                Play
              </ModeButton>
              <ModeButton
                active={mode === "live"}
                onClick={() => {
                  selectMode("live");
                  setCameraView("golfer");
                  setCameraCommand(null);
                  if (
                    strategyState.holeNumber !== selectedHole.holeNumber ||
                    strategyState.status === "idle" ||
                    strategyState.status === "error"
                  ) {
                    loadStrategy(selectedHole.holeNumber);
                  }
                  if (bridgeState.status === "idle" || bridgeState.status === "error") {
                    detectBridge();
                  }
                }}
              >
                Live
              </ModeButton>
              <ModeButton
                active={mode === "explore"}
                onClick={() => {
                  selectMode("explore");
                  setPlaying(false);
                  setCameraCommand(null);
                  setExplorePosition(selectedHole.tee);
                }}
              >
                Explore
              </ModeButton>
            </>
          ) : null}
        </div>

        {mode === "explore" ? (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            <ModeButton
              active={exploreTransport === "walk"}
              onClick={() => setExploreTransport("walk")}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <Footprints className="size-4" /> Walk
              </span>
            </ModeButton>
            <ModeButton
              active={exploreTransport === "cart"}
              onClick={() => setExploreTransport("cart")}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <CarFront className="size-4" /> Cart
              </span>
            </ModeButton>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            <ModeButton
              active={cameraView === "golfer"}
              onClick={() => {
                setCameraView("golfer");
                setCameraCommand(null);
              }}
            >
              {mode === "replay" || mode === "play" || mode === "live"
                ? "Shot view"
                : "Golfer view"}
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
        )}

        {mode === "explore" ? (
          <>
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-emerald-100/65">
              {exploreTransport === "walk"
                ? "Walk the mapped terrain with W/S, strafe with A/D and turn with the arrow keys."
                : "Drive the course with W/S and steer with A/D or the arrow keys. Hold Shift for a faster cart pace."}
            </div>
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-emerald-200" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/70">
                  Group session
                </p>
              </div>
              {roomState.status === "ready" && roomState.room ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
                    <div>
                      <p className="text-[11px] text-emerald-100/50">Invite code</p>
                      <p className="font-mono text-base font-semibold tracking-[0.18em]">
                        {roomState.room.inviteCode}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10"
                      aria-label="Copy group invite code"
                      onClick={() => {
                        void navigator.clipboard.writeText(roomState.room?.inviteCode ?? "");
                        setRoomCodeCopied(true);
                        window.setTimeout(() => setRoomCodeCopied(false), 1_500);
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-emerald-100/65">
                    {roomCodeCopied
                      ? "Invite code copied."
                      : `${roomState.room.members.filter((member) => member.role !== "spectator").length} golfer(s) · ${roomState.room.members.filter((member) => member.role === "spectator").length} spectator(s) connected.`}
                  </p>
                  <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-emerald-100/65">
                    <p className="font-semibold text-emerald-100">
                      {roomState.room.competition
                        ? "Verified competition room"
                        : "Shared practice room"}
                    </p>
                    <p className="mt-1">
                      {roomState.room.visibility === "public" ? "Public lobby" : "Private invite"} ·
                      You joined as {roomState.room.currentRole} · {roomState.room.sharedEventCount}{" "}
                      verified {roomState.room.sharedEventCount === 1 ? "event" : "events"}
                    </p>
                    {roomState.room.finalEventHash ? (
                      <p className="mt-1 font-mono text-[10px] text-emerald-200/70">
                        Locked {roomState.room.finalEventHash.slice(0, 12)}…
                      </p>
                    ) : roomState.room.latestSharedEvent ? (
                      <p className="mt-1 text-[11px] text-emerald-200/70">
                        Latest: {roomState.room.latestSharedEvent.eventType.replaceAll(".", " ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    {roomState.room.members.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between text-xs text-emerald-100/75"
                      >
                        <span>
                          {member.displayName}
                          <span className="ml-1 text-emerald-100/40">· {member.role}</span>
                        </span>
                        <span>
                          Hole {member.holeNumber} · {member.transport}
                        </span>
                      </div>
                    ))}
                  </div>
                  <CourseTwinComms
                    roomId={roomState.room.id}
                    currentUserId={roomState.room.currentUserId}
                    members={roomState.room.members}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full !border-white/15 !bg-transparent !text-white hover:!bg-white/10"
                    onClick={leaveRoom}
                  >
                    <LogOut className="mr-2 size-4" /> Leave group
                  </Button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
                    {([false, true] as const).map((competition) => (
                      <button
                        key={String(competition)}
                        type="button"
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs font-semibold",
                          roomCompetition === competition
                            ? "bg-[#e7ff6a] text-[#102217]"
                            : "text-emerald-100/60",
                        )}
                        onClick={() => setRoomCompetition(competition)}
                      >
                        {competition ? "Competition" : "Practice"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
                    {(["private", "public"] as const).map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs font-semibold capitalize",
                          roomVisibility === visibility
                            ? "bg-white/15 text-white"
                            : "text-emerald-100/55",
                        )}
                        onClick={() => setRoomVisibility(visibility)}
                      >
                        {visibility === "private" ? "Invite only" : "Public lobby"}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    className="w-full bg-emerald-300 text-[#092013] hover:bg-emerald-200"
                    disabled={roomState.status === "loading"}
                    onClick={createRoom}
                  >
                    Start group session
                  </Button>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
                    {(["player", "spectator"] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        className={cn(
                          "rounded-md px-2 py-1.5 text-xs font-semibold",
                          roomJoinRole === role ? "bg-white/15 text-white" : "text-emerald-100/55",
                        )}
                        onClick={() => setRoomJoinRole(role)}
                      >
                        Join as {role}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={roomInviteCode}
                      onChange={(event) => setRoomInviteCode(event.target.value.toUpperCase())}
                      maxLength={12}
                      placeholder="Invite code"
                      aria-label="Group invite code"
                      className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 text-sm uppercase tracking-[0.12em] text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-white/35 focus:border-emerald-300"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10"
                      disabled={roomState.status === "loading" || roomInviteCode.length < 6}
                      onClick={joinRoom}
                    >
                      Join
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full !border-white/15 !bg-transparent !text-white hover:!bg-white/10"
                    disabled={publicRoomsLoading}
                    onClick={() => void loadPublicRooms()}
                  >
                    {publicRoomsLoading ? "Finding public rooms…" : "Browse public rooms"}
                  </Button>
                  {publicRooms.length ? (
                    <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-white/10 bg-black/15 p-2">
                      {publicRooms.map((room) => (
                        <button
                          key={room.id}
                          type="button"
                          disabled={!room.canJoin}
                          onClick={() => void joinPublicRoom(room.inviteCode)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-emerald-100/75 hover:bg-white/10 disabled:opacity-40"
                        >
                          <span>
                            <span className="block font-semibold text-emerald-100">
                              {room.hostName}
                            </span>
                            Hole {room.holeNumber} · {room.competition ? "competition" : room.mode}
                          </span>
                          <span>
                            {room.memberCount}/{room.maxPlayers}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {roomState.status === "error" ? (
                    <p className="text-xs text-amber-200">{roomState.error}</p>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : (
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
        )}

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
                Viewing
              </p>
              <p className="mt-1 text-xl font-semibold">Hole {selectedHole.holeNumber}</p>
              <p className="text-sm text-emerald-100/60">
                {roundLocksHole && activeRound.currentHole !== activeRoundPhysicalHoleNumber
                  ? `Round hole ${activeRound.currentHole} · mapped hole ${selectedHole.holeNumber} · Par ${selectedHole.par} · ${selectedHole.yards} yd`
                  : `Par ${selectedHole.par} · ${selectedHole.yards} yd`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="!border-white/15 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white"
                disabled={roundLocksHole || selectedHoleIndex <= 0}
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
                disabled={roundLocksHole || selectedHoleIndex >= manifest.holes.length - 1}
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
                disabled={roundLocksHole && hole.holeNumber !== activeRoundPhysicalHoleNumber}
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
            simulation={selectedSimulation}
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
        ) : mode === "strategy" ? (
          <StrategyControls
            state={strategyState}
            selectedClub={strategyClub}
            onSelectClub={setStrategyClubId}
            onRetry={() => loadStrategy(selectedHole.holeNumber)}
          />
        ) : mode === "play" ? (
          <>
            <RoundSetupControls
              mode="play"
              puttingVerified={manifest.quality.grade === "A" && manifest.quality.verified}
              activeRound={activeRound}
              holes={manifest.holes}
              currentHoleStrokes={virtualStrokes}
              rules={roundRules}
              holeCount={roundHoleCount}
              startingHole={roundStartingHole}
              sync={roundSync}
              onRulesChange={setRoundRules}
              onHoleCountChange={setRoundHoleCount}
              onStartingHoleChange={setRoundStartingHole}
              onStart={() => void startPersistedRound("play")}
              onRetry={() => setRoundRetryToken((value) => value + 1)}
            />
            {activeRound?.mode === "play" && activeRound.status === "in_progress" ? (
              manualPuttingVisible && !virtualShot && virtualPuttStart ? (
                <ManualPuttingControls
                  hole={selectedHole}
                  start={virtualPuttStart}
                  puttNumber={virtualPuttNumber}
                  strokes={virtualStrokes}
                  aimOffsetDeg={virtualPuttAimDeg}
                  pacePercent={virtualPuttPacePercent}
                  result={virtualPuttResult}
                  playback={playback}
                  sync={roundSync}
                  verified={manifest.quality.grade === "A" && manifest.quality.verified}
                  onAimChange={setVirtualPuttAimDeg}
                  onPaceChange={setVirtualPuttPacePercent}
                  onPlay={() => {
                    if (!sampleTerrain || roundSync.status === "saving") return;
                    const eventId = crypto.randomUUID();
                    const result = simulateCourseTwinPutt(
                      {
                        start: {
                          x: virtualPuttStart[0],
                          y: sampleTerrain(virtualPuttStart[0], virtualPuttStart[2]),
                          z: virtualPuttStart[2],
                        },
                        hole: {
                          x: selectedHole.green[0],
                          y: sampleTerrain(selectedHole.green[0], selectedHole.green[2]),
                          z: selectedHole.green[2],
                        },
                        aimOffsetDeg: virtualPuttAimDeg,
                        pacePercent: virtualPuttPacePercent,
                      },
                      { groundHeight: sampleTerrain, surfaceAt: classifySurface },
                    );
                    setVirtualPuttEventId(eventId);
                    setVirtualPuttResult(result);
                    setVirtualStrokes((current) => current + 1);
                    setPlayback(0);
                    setPlaying(true);
                    setCameraView("golfer");
                    setCameraCommand(null);
                  }}
                  onContinue={() => {
                    if (!virtualPuttResult || roundSync.status !== "ready") return;
                    setVirtualPuttNumber((current) => current + 1);
                    setVirtualPuttResult(null);
                    setVirtualPuttEventId(null);
                    setPlayback(0);
                    setPlaying(false);
                    setCameraCommand(null);
                  }}
                  onRetry={() => {
                    if (virtualPuttEventId) {
                      submittedRoundEventsRef.current.delete(virtualPuttEventId);
                    }
                    setRoundRetryToken((value) => value + 1);
                  }}
                />
              ) : (
                <VirtualRoundControls
                  state={strategyState}
                  hole={selectedHole}
                  selectedClub={virtualStrategyClub}
                  availableClubs={virtualClubOptions}
                  lieSurface={virtualLieSurface}
                  shotKind={virtualShotKind}
                  shotKindOptions={virtualShotKindOptions}
                  onShotKindChange={(kind) => {
                    setVirtualShotKindChoice(kind);
                    setVirtualAimDirectionDeg(0);
                  }}
                  onSelectClub={setStrategyClubId}
                  start={virtualStart}
                  aimDirectionDeg={virtualAimDirectionDeg}
                  onAimDirectionChange={setVirtualAimDirectionDeg}
                  shotNumber={virtualShotNumber}
                  strokes={virtualStrokes}
                  penaltyStrokes={virtualPenaltyStrokes}
                  shot={virtualShot}
                  simulation={virtualSimulation}
                  playback={playback}
                  sync={roundSync.status}
                  rules={activeRound.rulesJson}
                  onPlay={() => {
                    if (!virtualStrategyClub || roundSync.status === "saving") return;
                    if (selectedHole.holeNumber !== activeRoundPhysicalHoleNumber) {
                      restorePersistedRoundHole(activeRound);
                      return;
                    }
                    setVirtualRoundEventId(crypto.randomUUID());
                    setVirtualShot(
                      buildCourseTwinVirtualShot({
                        courseId: manifest.course.id,
                        hole: selectedHole,
                        start: virtualStart,
                        club: virtualStrategyClub,
                        aimOffsetYd: 0,
                        aimDirectionDeg: virtualAimDirectionDeg,
                        shotNumber: virtualShotNumber,
                        lieSurface: virtualLieSurface,
                        surfaceAt: classifySurface,
                        requestedShotKind: virtualShotKind,
                      }),
                    );
                    setVirtualStrokes((current) => current + 1);
                    setPlayback(0);
                    setPlaying(true);
                    setCameraCommand(null);
                  }}
                  onContinue={() => {
                    if (!virtualSimulation || roundSync.status !== "ready") return;
                    const next = virtualDropPoint(virtualSimulation);
                    setVirtualStart([next.x, 0, next.z]);
                    setVirtualShotNumber((current) => current + 1);
                    setVirtualShotKindChoice(null);
                    if (virtualSimulation.penalty) {
                      setVirtualStrokes((current) => current + 1);
                      setVirtualPenaltyStrokes((current) => current + 1);
                    }
                    setVirtualShot(null);
                    setVirtualRoundEventId(null);
                    setPlayback(0);
                    setPlaying(false);
                    setCameraCommand(null);
                  }}
                  onMulligan={() => {
                    if (virtualRoundEventId) {
                      void takePersistedMulligan("play", virtualRoundEventId);
                    }
                  }}
                  onRetry={() => {
                    if (virtualRoundEventId) {
                      submittedRoundEventsRef.current.delete(virtualRoundEventId);
                    }
                    setRoundRetryToken((value) => value + 1);
                  }}
                  onStrategyRetry={() => loadStrategy(selectedHole.holeNumber)}
                />
              )
            ) : null}
          </>
        ) : mode === "live" ? (
          <>
            <RoundSetupControls
              mode="live"
              puttingVerified={manifest.quality.grade === "A" && manifest.quality.verified}
              activeRound={activeRound}
              holes={manifest.holes}
              currentHoleStrokes={liveStrokes}
              rules={roundRules}
              holeCount={roundHoleCount}
              startingHole={roundStartingHole}
              sync={roundSync}
              onRulesChange={setRoundRules}
              onHoleCountChange={setRoundHoleCount}
              onStartingHoleChange={setRoundStartingHole}
              onStart={() => void startPersistedRound("live")}
              onRetry={() => setRoundRetryToken((value) => value + 1)}
            />
            {activeRound?.mode === "live" && activeRound.status === "in_progress" ? (
              <LiveRoundControls
                bridge={bridgeState}
                pairingCode={pairingCode}
                onPairingCodeChange={setPairingCode}
                onDetect={detectBridge}
                onPair={pairBridge}
                onDownloadDiagnostics={downloadBridgeDiagnostics}
                hole={selectedHole}
                strategy={strategyState}
                selectedClub={strategyClub}
                onSelectClub={setStrategyClubId}
                handed={liveHanded}
                onHandedChange={setLiveHanded}
                shotNumber={liveShotNumber}
                strokes={liveStrokes}
                penaltyStrokes={livePenaltyStrokes}
                shot={liveShot}
                simulation={liveSimulation}
                playback={playback}
                sync={roundSync.status}
                rules={activeRound.rulesJson}
                onContinue={() => {
                  if (!liveSimulation || roundSync.status !== "ready") return;
                  const next = virtualDropPoint(liveSimulation);
                  setLiveStart([next.x, 0, next.z]);
                  setLiveShotNumber((current) => current + 1);
                  if (liveSimulation.penalty) {
                    setLiveStrokes((current) => current + 1);
                    setLivePenaltyStrokes((current) => current + 1);
                  }
                  setLiveShot(null);
                  setLiveRoundEventId(null);
                  setPlayback(0);
                  setPlaying(false);
                  setCameraCommand(null);
                }}
                onMulligan={() => {
                  if (liveRoundEventId) void takePersistedMulligan("live", liveRoundEventId);
                }}
                onRetry={() => {
                  if (liveRoundEventId) {
                    submittedRoundEventsRef.current.delete(liveRoundEventId);
                  }
                  setRoundRetryToken((value) => value + 1);
                }}
              />
            ) : null}
          </>
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

      <section className="order-1 relative min-h-[62dvh] overflow-hidden xl:sticky xl:top-14 xl:order-2 xl:h-[calc(100dvh-3.5rem)] xl:min-h-0 xl:self-start">
        <Canvas
          shadows="percentage"
          dpr={[1, 1.75]}
          style={{
            cursor: mode === "play" && !virtualShot && !virtualPuttReplay ? "crosshair" : "default",
          }}
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
            <>
              {mode === "explore" ? (
                <RoamController
                  key={`${selectedHole.holeNumber}-${exploreTransport}`}
                  hole={selectedHole}
                  transport={exploreTransport}
                  bounds={manifest.terrain.heightmap?.localBounds ?? manifest.bounds}
                  sampleTerrain={sampleTerrain}
                  onPosition={setExplorePosition}
                />
              ) : null}
              <Suspense fallback={null}>
                <CourseWorld
                  manifest={manifest}
                  terrainSamples={terrainSamples}
                  sampleTerrain={sampleTerrain}
                  selectedHole={selectedHole}
                  selectedShot={
                    mode === "replay"
                      ? selectedShot
                      : mode === "play"
                        ? (virtualPuttReplay?.shot ?? virtualShot?.shot ?? null)
                        : mode === "live"
                          ? liveShot
                          : null
                  }
                  selectedSimulation={
                    mode === "replay"
                      ? selectedSimulation
                      : mode === "play"
                        ? (virtualPuttReplay?.simulation ?? virtualSimulation)
                        : mode === "live"
                          ? liveSimulation
                          : null
                  }
                  completedTracers={mode === "play" ? virtualCompletedTracers : []}
                  nextShotStart={
                    mode === "play" && !virtualShot && !virtualPuttReplay ? virtualStart : null
                  }
                  aimStart={
                    mode === "play" && !virtualShot && !virtualPuttReplay ? virtualStart : null
                  }
                  aimEnd={
                    mode === "play" && !virtualShot && !virtualPuttReplay ? virtualAimTarget : null
                  }
                  onAimPoint={
                    mode === "play" && !virtualShot && !virtualPuttReplay
                      ? (point) =>
                          setVirtualAimDirectionDeg(
                            courseTwinAimDirectionDegToPoint(
                              virtualStart,
                              selectedHole.green,
                              point,
                              virtualShotKind,
                            ),
                          )
                      : null
                  }
                  cameraStart={
                    animatedShot?.start ??
                    (mode === "play"
                      ? virtualStart
                      : mode === "live"
                        ? liveStart
                        : selectedHole.tee)
                  }
                  cameraEnd={
                    animatedShot?.totalEnd ??
                    (mode === "play" && !virtualShot && !virtualPuttReplay
                      ? virtualAimTarget
                      : selectedHole.green)
                  }
                  cameraUsesShotFraming={Boolean(animatedShot)}
                  strategyClub={mode === "strategy" ? strategyClub : null}
                  playback={playback}
                  cameraView={cameraView}
                  cameraCommand={cameraCommand}
                  exploreTransport={mode === "explore" ? exploreTransport : null}
                />
              </Suspense>
            </>
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
  selectedSimulation,
  completedTracers,
  nextShotStart,
  aimStart,
  aimEnd,
  onAimPoint,
  cameraStart,
  cameraEnd,
  cameraUsesShotFraming,
  strategyClub,
  playback,
  cameraView,
  cameraCommand,
  exploreTransport,
}: {
  manifest: CourseTwinManifest;
  terrainSamples: Float32Array;
  sampleTerrain: CourseTwinTerrainSampler;
  selectedHole: CourseTwinHole;
  selectedShot: CourseTwinReplayShot | null;
  selectedSimulation: CourseTwinReplaySimulation | null;
  completedTracers: Array<{ id: string; simulation: CourseTwinReplaySimulation }>;
  nextShotStart: CourseTwinPoint | null;
  aimStart: CourseTwinPoint | null;
  aimEnd: CourseTwinPoint | null;
  onAimPoint: ((point: CourseTwinPoint) => void) | null;
  cameraStart: CourseTwinPoint;
  cameraEnd: CourseTwinPoint;
  cameraUsesShotFraming: boolean;
  strategyClub: CourseTwinStrategyClub | null;
  playback: number;
  cameraView: CameraView;
  cameraCommand: CameraCommand;
  exploreTransport: ExploreTransport | null;
}) {
  const holeLength = Math.max(
    1,
    Math.hypot(cameraEnd[0] - cameraStart[0], cameraEnd[2] - cameraStart[2]),
  );
  const focusDistance = cameraUsesShotFraming
    ? cameraView === "golfer"
      ? THREE.MathUtils.clamp(holeLength * 0.65, 24, 72)
      : THREE.MathUtils.clamp(holeLength * 0.75, 38, 165)
    : cameraView === "golfer"
      ? THREE.MathUtils.clamp(holeLength * 0.62, 28, 85)
      : Math.min(holeLength * 0.58, 165);
  const focusX = cameraStart[0] + ((cameraEnd[0] - cameraStart[0]) / holeLength) * focusDistance;
  const focusZ = cameraStart[2] + ((cameraEnd[2] - cameraStart[2]) / holeLength) * focusDistance;
  const golferFraming = cameraUsesShotFraming ? GOLFER_SHOT_CAMERA : GOLFER_TEE_CAMERA;
  const focusGroundY = sampleTerrain(focusX, focusZ);
  const center: [number, number, number] = [
    focusX,
    cameraView === "golfer"
      ? Math.max(
          focusGroundY + (cameraUsesShotFraming ? 0.6 : 0.5),
          sampleTerrain(cameraStart[0], cameraStart[2]) + golferFraming.eyeHeight - 0.35,
        )
      : focusGroundY,
    focusZ,
  ];

  return (
    <group>
      <Terrain manifest={manifest} samples={terrainSamples} onAimPoint={onAimPoint} />
      {(manifest.puttingSurfaces ?? [])
        .filter((surface) => surface.holeNumber === selectedHole.holeNumber)
        .map((surface) => (
          <PuttingSurfaceMesh key={surface.holeNumber} surface={surface} />
        ))}
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
          dimmed={
            hole === selectedHole &&
            (Boolean(selectedShot) || completedTracers.length > 0 || Boolean(nextShotStart))
          }
          sampleTerrain={sampleTerrain}
        />
      ))}
      {selectedShot && selectedSimulation ? (
        <ReplayTracer
          key={selectedShot.id}
          simulation={selectedSimulation}
          playback={playback}
          active
        />
      ) : null}
      {completedTracers.map((tracer) => (
        <ReplayTracer
          key={tracer.id}
          simulation={tracer.simulation}
          playback={1}
          active={false}
          showCarryMarker={false}
          showFinishMarker={
            !nextShotStart ||
            !courseTwinGroundPositionsCoincide(tracer.simulation.finalPosition, nextShotStart)
          }
        />
      ))}
      {nextShotStart ? (
        <NextShotMarker position={nextShotStart} sampleTerrain={sampleTerrain} />
      ) : null}
      {aimStart && aimEnd ? (
        <ShotAimGuide start={aimStart} end={aimEnd} sampleTerrain={sampleTerrain} />
      ) : null}
      {strategyClub ? (
        <StrategyLandingCloud
          club={strategyClub}
          sampleTerrain={sampleTerrain}
          hole={selectedHole}
        />
      ) : null}
      {!exploreTransport ? (
        <>
          <CameraFocus
            start={cameraStart}
            end={cameraEnd}
            shotFraming={cameraUsesShotFraming}
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
        </>
      ) : null}
    </group>
  );
}

function PuttingSurfaceMesh({ surface }: { surface: CourseTwinPuttingSurface }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(surface.width * surface.height * 3);
    const indices: number[] = [];
    const xSpan = surface.localBounds.maxX - surface.localBounds.minX;
    const zSpan = surface.localBounds.maxZ - surface.localBounds.minZ;
    for (let row = 0; row < surface.height; row += 1) {
      for (let column = 0; column < surface.width; column += 1) {
        const sampleIndex = row * surface.width + column;
        const positionIndex = sampleIndex * 3;
        positions[positionIndex] =
          surface.localBounds.minX + (column / (surface.width - 1)) * xSpan;
        positions[positionIndex + 1] = surface.elevationsM[sampleIndex] + 0.012;
        positions[positionIndex + 2] =
          surface.localBounds.minZ + (row / (surface.height - 1)) * zSpan;
        if (row < surface.height - 1 && column < surface.width - 1) {
          const nextRow = sampleIndex + surface.width;
          indices.push(
            sampleIndex,
            nextRow,
            sampleIndex + 1,
            sampleIndex + 1,
            nextRow,
            nextRow + 1,
          );
        }
      }
    }
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    mesh.setIndex(indices);
    mesh.computeVertexNormals();
    return mesh;
  }, [surface]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#4d8b3f"
        roughness={0.93}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

function Terrain({
  manifest,
  samples,
  onAimPoint,
}: {
  manifest: CourseTwinManifest;
  samples: Float32Array;
  onAimPoint: ((point: CourseTwinPoint) => void) | null;
}) {
  const asset = manifest.terrain.heightmap;
  const imagery = manifest.terrain.imagery;
  if (!asset || !imagery) return null;
  return (
    <LidarTerrain
      asset={asset}
      imageryUrl={imagery.url}
      samples={samples}
      features={manifest.features}
      onAimPoint={onAimPoint}
    />
  );
}

function LidarTerrain({
  asset,
  imageryUrl,
  samples,
  features,
  onAimPoint,
}: {
  asset: NonNullable<CourseTwinManifest["terrain"]["heightmap"]>;
  imageryUrl: string;
  samples: Float32Array;
  features: CourseTwinFeature[];
  onAimPoint: ((point: CourseTwinPoint) => void) | null;
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
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={
        onAimPoint
          ? (event) => {
              event.stopPropagation();
              onAimPoint([event.point.x, event.point.y, event.point.z]);
            }
          : undefined
      }
    >
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
    textures.forEach((texture, index) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const treeAsset = index < treeBillboards.length ? treeBillboards[index] : null;
      const cropTop = treeAsset && "cropTop" in treeAsset ? treeAsset.cropTop : 0;
      texture.offset.set(0, 0);
      texture.repeat.set(1, 1 - cropTop);
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
  const points = hole.centerline.map((point) => terrainSurfacePoint(point, sampleTerrain, 0.08));
  const tee = terrainSurfacePoint(hole.tee, sampleTerrain, 0.08);
  const green = terrainSurfacePoint(hole.green, sampleTerrain, 0);
  return (
    <group>
      <Line
        points={points}
        color={selected ? "#efffb5" : "#d7f5d1"}
        lineWidth={selected ? 2.4 : 0.8}
        transparent
        opacity={dimmed ? 0 : selected ? 1 : 0.42}
      />
      {!dimmed ? (
        <mesh position={tee} castShadow>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 20]} />
          <meshStandardMaterial color={selected ? "#f7f4de" : "#a7c6a2"} roughness={0.72} />
        </mesh>
      ) : null}
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

function NextShotMarker({
  position,
  sampleTerrain,
}: {
  position: CourseTwinPoint;
  sampleTerrain: CourseTwinTerrainSampler;
}) {
  const point: [number, number, number] = [
    position[0],
    sampleTerrain(position[0], position[2]) + 0.02,
    position[2],
  ];
  return (
    <group position={point}>
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.14, 0.24, 32]} />
        <meshBasicMaterial color="#e7ff6a" transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.055, 0]} castShadow>
        <sphereGeometry args={[0.045, 18, 18]} />
        <meshStandardMaterial color="#ffffff" emissive="#e7ff6a" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

function ShotAimGuide({
  start,
  end,
  sampleTerrain,
}: {
  start: CourseTwinPoint;
  end: CourseTwinPoint;
  sampleTerrain: CourseTwinTerrainSampler;
}) {
  const points = Array.from({ length: 33 }, (_, index) => {
    const progress = index / 32;
    const x = start[0] + (end[0] - start[0]) * progress;
    const z = start[2] + (end[2] - start[2]) * progress;
    return [x, sampleTerrain(x, z) + 0.08, z] satisfies [number, number, number];
  });
  const target = points.at(-1) ?? points[0];
  return (
    <group>
      <Line
        points={points}
        color="#7de8ff"
        lineWidth={2.4}
        transparent
        opacity={0.74}
        depthTest={false}
        renderOrder={12}
      />
      <mesh position={target} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.3, 1.65, 40]} />
        <meshBasicMaterial color="#7de8ff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ReplayTracer({
  simulation,
  playback,
  active,
  showCarryMarker = true,
  showFinishMarker = true,
}: {
  simulation: CourseTwinReplaySimulation;
  playback: number;
  active: boolean;
  showCarryMarker?: boolean;
  showFinishMarker?: boolean;
}) {
  const flight = simulation.frames
    .filter((frame) => frame.timeS <= simulation.flightTimeS + Number.EPSILON)
    .map(replayFramePoint);
  const ground = simulation.frames
    .filter((frame) => frame.timeS + Number.EPSILON >= simulation.flightTimeS)
    .map(replayFramePoint);
  const currentFrame = sampleCourseTwinSimulation(simulation, playback);
  const marker = currentFrame
    ? replayFramePoint(currentFrame)
    : replayFramePoint(simulation.frames[0]);
  const carry = replayVectorPoint(simulation.carryPosition, 0.08);
  const finish = replayVectorPoint(simulation.finalPosition, 0.08);
  return (
    <group>
      <Line
        points={flight.length >= 2 ? flight : [carry, carry]}
        color={active ? "#f8ff84" : "#ffbd70"}
        lineWidth={active ? 2.1 : 1.5}
        transparent
        opacity={active ? 0.94 : 0.78}
      />
      {ground.length >= 2 ? (
        <Line
          points={ground}
          color={active ? "#ffffff" : "#ffd3a0"}
          lineWidth={active ? 2 : 1.6}
          dashed
          dashSize={3}
          gapSize={2}
          transparent
          opacity={active ? 0.9 : 0.72}
        />
      ) : null}
      {showCarryMarker ? (
        <mesh position={carry} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.5, 28]} />
          <meshBasicMaterial color="#f8ff84" transparent opacity={0.82} depthWrite={false} />
        </mesh>
      ) : null}
      {showFinishMarker ? (
        <mesh position={finish} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.48, 0.66, 28]} />
          <meshBasicMaterial
            color={simulation.penalty ? "#fb7185" : "#ffffff"}
            transparent
            opacity={0.88}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {active ? (
        <mesh position={marker} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color="#ffffff" emissive="#e7ff6a" emissiveIntensity={1.4} />
        </mesh>
      ) : showFinishMarker ? (
        <mesh position={finish}>
          <sphereGeometry args={[0.24, 12, 12]} />
          <meshStandardMaterial color="#ffbd70" emissive="#ff8a3d" emissiveIntensity={0.4} />
        </mesh>
      ) : null}
    </group>
  );
}

function courseTwinGroundPositionsCoincide(
  finish: { x: number; z: number },
  nextStart: CourseTwinPoint,
) {
  return Math.hypot(finish.x - nextStart[0], finish.z - nextStart[2]) <= 0.25;
}

function replayFramePoint(frame: CourseTwinSimulationFrame): [number, number, number] {
  return replayVectorPoint(frame.position, 0.14);
}

function replayVectorPoint(
  point: { x: number; y: number; z: number },
  verticalOffset: number,
): [number, number, number] {
  return [point.x, point.y + verticalOffset, point.z];
}

function StrategyLandingCloud({
  club,
  sampleTerrain,
  hole,
}: {
  club: CourseTwinStrategyClub;
  sampleTerrain: CourseTwinTerrainSampler;
  hole: CourseTwinHole;
}) {
  const positions = useMemo(() => {
    const values = new Float32Array(club.landingCloud.length * 3);
    for (let index = 0; index < club.landingCloud.length; index += 1) {
      const point = club.landingCloud[index];
      values[index * 3] = point[0];
      values[index * 3 + 1] = sampleTerrain(point[0], point[2]) + 0.42;
      values[index * 3 + 2] = point[2];
    }
    return values;
  }, [club.landingCloud, sampleTerrain]);
  const pointTexture = useMemo(() => strategyPointTexture(), []);
  const cloudCenter = useMemo(() => {
    if (club.landingCloud.length === 0) return toTerrainPoint(hole.green, sampleTerrain);
    const total = club.landingCloud.reduce(
      (sum, point) => ({ x: sum.x + point[0], z: sum.z + point[2] }),
      { x: 0, z: 0 },
    );
    const x = total.x / club.landingCloud.length;
    const z = total.z / club.landingCloud.length;
    return [x, sampleTerrain(x, z) + 0.48, z] as [number, number, number];
  }, [club.landingCloud, hole.green, sampleTerrain]);
  const tee = toTerrainPoint(hole.tee, sampleTerrain);

  return (
    <group>
      <Line
        points={[tee, cloudCenter]}
        color="#e7ff6a"
        lineWidth={1.2}
        dashed
        dashSize={5}
        gapSize={3}
        transparent
        opacity={0.72}
      />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#e7ff6a"
          map={pointTexture}
          alphaTest={0.08}
          size={1.7}
          sizeAttenuation
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </points>
      <mesh position={cloudCenter} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.75, 44]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

function strategyPointTexture() {
  const cached = proceduralTextureCache.get("strategy-point");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Strategy point textures are unavailable.");
  const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  proceduralTextureCache.set("strategy-point", texture);
  return texture;
}

function RoamController({
  hole,
  transport,
  bounds,
  sampleTerrain,
  onPosition,
}: {
  hole: CourseTwinHole;
  transport: ExploreTransport;
  bounds: CourseTwinManifest["bounds"];
  sampleTerrain: CourseTwinTerrainSampler;
  onPosition: (position: CourseTwinPoint) => void;
}) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const position = useRef(new THREE.Vector3(hole.tee[0], hole.tee[1], hole.tee[2]));
  const yaw = useRef(Math.atan2(hole.green[0] - hole.tee[0], hole.green[2] - hole.tee[2]));
  const reportElapsed = useRef(0);

  useEffect(() => {
    const pressedKeys = keys.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      pressedKeys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      pressedKeys.clear();
    };
  }, []);

  useLayoutEffect(() => {
    const height = transport === "cart" ? 2.35 : 1.72;
    const point = position.current;
    point.y = sampleTerrain(point.x, point.z);
    camera.position.set(point.x, point.y + height, point.z);
    camera.lookAt(
      point.x + Math.sin(yaw.current) * 12,
      point.y + height * 0.82,
      point.z + Math.cos(yaw.current) * 12,
    );
    camera.updateProjectionMatrix();
    onPosition([point.x, point.y, point.z]);
  }, [camera, onPosition, sampleTerrain, transport]);

  const advanceMovement = useCallback(
    (rawDelta: number) => {
      const delta = Math.min(0.05, rawDelta);
      const pressed = keys.current;
      const forwardInput =
        (pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0) -
        (pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0);
      const lateralInput =
        (pressed.has("KeyD") || pressed.has("ArrowRight") ? 1 : 0) -
        (pressed.has("KeyA") || pressed.has("ArrowLeft") ? 1 : 0);
      const isCart = transport === "cart";
      if (isCart && lateralInput !== 0) {
        const direction = forwardInput === 0 ? 1 : Math.sign(forwardInput);
        yaw.current -= lateralInput * direction * delta * 1.35;
      } else {
        const turnInput = (pressed.has("ArrowLeft") ? 1 : 0) - (pressed.has("ArrowRight") ? 1 : 0);
        yaw.current += turnInput * delta * 1.65;
      }
      const fast = pressed.has("ShiftLeft") || pressed.has("ShiftRight");
      const speed = isCart ? (fast ? 24 : 14) : fast ? 7 : 4.5;
      const point = position.current;
      const forwardX = Math.sin(yaw.current);
      const forwardZ = Math.cos(yaw.current);
      point.x += forwardX * forwardInput * speed * delta;
      point.z += forwardZ * forwardInput * speed * delta;
      if (!isCart) {
        point.x += Math.cos(yaw.current) * lateralInput * speed * delta;
        point.z -= Math.sin(yaw.current) * lateralInput * speed * delta;
      }
      point.x = THREE.MathUtils.clamp(point.x, bounds.minX + 2, bounds.maxX - 2);
      point.z = THREE.MathUtils.clamp(point.z, bounds.minZ + 2, bounds.maxZ - 2);
      point.y = sampleTerrain(point.x, point.z);
      const height = isCart ? 2.35 : 1.72;
      camera.position.set(point.x, point.y + height, point.z);
      camera.lookAt(point.x + forwardX * 12, point.y + height * 0.82, point.z + forwardZ * 12);
      reportElapsed.current += delta;
      if (reportElapsed.current >= 0.2) {
        reportElapsed.current = 0;
        onPosition([point.x, point.y, point.z]);
      }
    },
    [
      bounds.maxX,
      bounds.maxZ,
      bounds.minX,
      bounds.minZ,
      camera,
      onPosition,
      sampleTerrain,
      transport,
    ],
  );

  useEffect(() => {
    const onAdvanceTime = (event: Event) => {
      const milliseconds = (event as CustomEvent<number>).detail;
      if (Number.isFinite(milliseconds)) advanceMovement(milliseconds / 1000);
    };
    window.addEventListener("course-twin-advance-time", onAdvanceTime);
    return () => window.removeEventListener("course-twin-advance-time", onAdvanceTime);
  }, [advanceMovement]);

  useFrame((_, rawDelta) => advanceMovement(rawDelta));
  return null;
}

function CameraFocus({
  start,
  end,
  shotFraming,
  sampleTerrain,
  view,
  command,
}: {
  start: CourseTwinPoint;
  end: CourseTwinPoint;
  shotFraming: boolean;
  sampleTerrain: CourseTwinTerrainSampler;
  view: CameraView;
  command: CameraCommand;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const terrainStart = terrainSurfacePoint(start, sampleTerrain);
    const terrainEnd = terrainSurfacePoint(end, sampleTerrain);
    const dx = terrainEnd[0] - terrainStart[0];
    const dz = terrainEnd[2] - terrainStart[2];
    const length = Math.max(1, Math.hypot(dx, dz));
    const directionX = dx / length;
    const directionZ = dz / length;
    const targetDistance = shotFraming
      ? view === "golfer"
        ? THREE.MathUtils.clamp(length * 0.65, 24, 72)
        : THREE.MathUtils.clamp(length * 0.75, 38, 165)
      : view === "golfer"
        ? THREE.MathUtils.clamp(length * 0.62, 28, 85)
        : Math.min(length * 0.58, 165);
    const targetX = terrainStart[0] + directionX * targetDistance;
    const targetZ = terrainStart[2] + directionZ * targetDistance;
    const framing = shotFraming ? GOLFER_SHOT_CAMERA : GOLFER_TEE_CAMERA;
    const targetGroundY = sampleTerrain(targetX, targetZ);
    const targetY =
      view === "golfer"
        ? Math.max(
            targetGroundY + (shotFraming ? 0.6 : 0.5),
            terrainStart[1] + framing.eyeHeight - 0.35,
          )
        : targetGroundY + 3;
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

    if (camera instanceof THREE.PerspectiveCamera) {
      setPerspectiveFov(
        camera,
        view === "golfer" ? (shotFraming ? GOLFER_SHOT_CAMERA.fov : GOLFER_TEE_CAMERA.fov) : 48,
      );
    }

    if (view === "golfer") {
      camera.position.set(
        terrainStart[0] -
          directionX * framing.behindDistance -
          directionZ * framing.lateralDistance,
        terrainStart[1] + framing.eyeHeight,
        terrainStart[2] -
          directionZ * framing.behindDistance +
          directionX * framing.lateralDistance,
      );
    } else {
      camera.position.set(
        terrainStart[0] - directionX * Math.min(62, length * 0.28) - directionZ * 42,
        terrainStart[1] + Math.min(140, Math.max(62, length * 0.34)),
        terrainStart[2] - directionZ * Math.min(62, length * 0.28) + directionX * 42,
      );
    }
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, command, end, sampleTerrain, shotFraming, start, view]);
  return null;
}

function ReplayControls({
  replay,
  shots,
  selectedShot,
  shotIndex,
  playing,
  playback,
  simulation,
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
  simulation: CourseTwinReplaySimulation | null;
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
          {simulation ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <ReplayFact label="Landed" value={formatSurface(simulation.landingSurface)} />
              <ReplayFact
                label={simulation.penalty ? "Penalty" : "Finished"}
                value={
                  simulation.penalty
                    ? formatPenalty(simulation.penalty)
                    : formatSurface(simulation.finalSurface)
                }
                alert={Boolean(simulation.penalty)}
              />
              <ReplayFact label="Flight" value={`${simulation.flightTimeS.toFixed(1)} sec`} />
              <ReplayFact
                label="Ground"
                value={`${simulation.bounceCount} ${simulation.bounceCount === 1 ? "bounce" : "bounces"} + roll`}
              />
            </div>
          ) : null}
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

function ReplayFact({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
      <p className="text-emerald-100/45">{label}</p>
      <p className={cn("mt-0.5 font-semibold", alert ? "text-rose-200" : "text-emerald-50")}>
        {value}
      </p>
    </div>
  );
}

function StrategyControls({
  state,
  selectedClub,
  onSelectClub,
  onRetry,
}: {
  state: StrategyLoadState;
  selectedClub: CourseTwinStrategyClub | null;
  onSelectClub: (clubId: string) => void;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
          My Bag strategy
        </p>
        <p className="mt-3 text-sm leading-6 text-emerald-100/60">
          Running measured dispersion against mapped hazards…
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mt-5 rounded-xl border border-amber-200/20 bg-amber-100/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/70">
          Strategy unavailable
        </p>
        <p className="mt-3 text-sm leading-6 text-amber-50/70">{state.error}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 !border-white/15 !bg-transparent !text-white hover:!bg-white/10"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (!state.document || !selectedClub) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-emerald-100/60">
        Choose Strategy to compare this hole with your measured bag.
      </div>
    );
  }

  const recommended = state.document.recommended?.clubId === selectedClub.clubId;
  const severeHazardProbability =
    selectedClub.probabilities.water +
    selectedClub.probabilities.out_of_bounds +
    selectedClub.probabilities.trees;
  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
            My Bag strategy
          </p>
          <p className="mt-2 text-lg font-semibold">{selectedClub.clubType}</p>
          <p className="text-sm text-emerald-100/60">
            {Math.round(selectedClub.carryMedianYd)} yd stock carry · {selectedClub.sampleSize}{" "}
            shots
          </p>
        </div>
        {recommended ? (
          <Badge className="border border-[#e7ff6a]/30 bg-[#e7ff6a]/10 text-[#efffa5] hover:bg-[#e7ff6a]/10">
            Recommended
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <ReplayFact
          label="Aim"
          value={
            Math.abs(selectedClub.aimOffsetYd) < 0.5
              ? "Centre"
              : `${Math.abs(selectedClub.aimOffsetYd).toFixed(1)} yd ${selectedClub.aimOffsetYd < 0 ? "left" : "right"}`
          }
        />
        <ReplayFact label="Leave" value={`${selectedClub.averageRemainingYd.toFixed(0)} yd avg`} />
        <ReplayFact
          label="Serious hazard"
          value={formatProbability(severeHazardProbability)}
          alert={severeHazardProbability >= 0.15}
        />
        <ReplayFact
          label="Bunker"
          value={formatProbability(selectedClub.probabilities.bunker)}
          alert={selectedClub.probabilities.bunker >= 0.2}
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {state.document.clubs.map((club) => (
          <button
            key={club.clubId}
            type="button"
            className={cn(
              "min-w-fit rounded-lg border px-3 py-2 text-sm font-semibold",
              club.clubId === selectedClub.clubId
                ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                : "border-white/10 bg-white/5",
            )}
            aria-label={`Model ${club.clubType}`}
            onClick={() => onSelectClub(club.clubId)}
          >
            {club.clubType}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-amber-100/70">
        {strategyConfidenceCopy(selectedClub)} {state.document.disclosure}
      </p>
    </div>
  );
}

function RoundSetupControls({
  mode,
  puttingVerified,
  activeRound,
  holes,
  currentHoleStrokes,
  rules,
  holeCount,
  startingHole,
  sync,
  onRulesChange,
  onHoleCountChange,
  onStartingHoleChange,
  onStart,
  onRetry,
}: {
  mode: "play" | "live";
  puttingVerified: boolean;
  activeRound: CourseTwinRoundClientDocument | null;
  holes: CourseTwinHole[];
  currentHoleStrokes: number;
  rules: CourseTwinRoundRules;
  holeCount: 9 | 18;
  startingHole: 1 | 10;
  sync: RoundSyncState;
  onRulesChange: (rules: CourseTwinRoundRules) => void;
  onHoleCountChange: (count: 9 | 18) => void;
  onStartingHoleChange: (hole: 1 | 10) => void;
  onStart: () => void;
  onRetry: () => void;
}) {
  if (activeRound?.status === "in_progress") {
    const score = courseTwinRoundScore(activeRound.summary.scorecard);
    const lastCompletedHole = activeRound.summary.scorecard.at(-1) ?? null;
    const lastMappedHole = lastCompletedHole
      ? holes.find((hole) => hole.holeNumber === lastCompletedHole.holeNumber)
      : null;
    const lastGreenShot =
      lastCompletedHole && activeRound.rulesJson.greenRule !== "manual_putts"
        ? activeRound.summary.acceptedShots
            .filter((shot) => shot.holeNumber === lastCompletedHole.holeNumber)
            .at(-1)
        : null;
    const automaticPuttDistanceFt =
      lastMappedHole && lastGreenShot
        ? courseTwinDistanceToPinYd(lastGreenShot.totalEnd, lastMappedHole.green) * 3
        : null;
    const relativeScore =
      score.relativeToPar === 0
        ? "Level par"
        : `${score.relativeToPar > 0 ? "+" : ""}${score.relativeToPar}`;
    const completedHoleCount = activeRound.summary.scorecard.length;
    const playedStrokeCount = score.strokes + currentHoleStrokes;
    return (
      <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
              {activeRound.mode === "play"
                ? "Course Twin strategy sandbox"
                : "Verified round ledger"}
            </p>
            <p className="mt-2 font-semibold">
              {activeRound.mode === "play" ? "My Bag test round" : "Live launch-monitor round"}
            </p>
            <p className="text-sm text-emerald-100/60">
              Hole {activeRound.currentHole} of {activeRound.holeCount} · {relativeScore} through{" "}
              {completedHoleCount} {completedHoleCount === 1 ? "hole" : "holes"}
            </p>
            <p className="mt-1 text-xs text-emerald-100/50">
              {score.strokes} completed + {currentHoleStrokes} current = {playedStrokeCount} played
            </p>
          </div>
          <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
            {sync.status === "saving" ? "Saving…" : `v${activeRound.version}`}
          </Badge>
        </div>
        {lastCompletedHole ? (
          <div className="mt-3 rounded-lg border border-emerald-300/15 bg-black/10 px-3 py-2">
            <p className="text-xs font-semibold text-emerald-50">
              Last hole · {lastCompletedHole.holeNumber} ·{" "}
              {courseTwinHoleScoreLabel(lastCompletedHole.strokes, lastCompletedHole.par)}
            </p>
            <p className="mt-1 text-xs text-emerald-100/60">
              {lastCompletedHole.strokes} on a par {lastCompletedHole.par}
              {automaticPuttDistanceFt !== null
                ? ` · automatic ${lastCompletedHole.putts}-putt from ${automaticPuttDistanceFt.toFixed(1)} ft`
                : ` · ${lastCompletedHole.putts} ${lastCompletedHole.putts === 1 ? "putt" : "putts"}`}
            </p>
          </div>
        ) : null}
        {activeRound.summary.scorecard.length > 0 ? (
          <div className="mt-3 grid grid-cols-6 gap-1.5" aria-label="Completed-hole scorecard">
            {activeRound.summary.scorecard.map((hole) => {
              const relative = hole.strokes - hole.par;
              return (
                <div
                  key={hole.holeNumber}
                  className="rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-center"
                  title={`Hole ${hole.holeNumber}: ${courseTwinHoleScoreLabel(hole.strokes, hole.par)}`}
                >
                  <span className="block text-[10px] text-emerald-100/45">H{hole.holeNumber}</span>
                  <span className="block text-xs font-semibold text-emerald-50">
                    {relative === 0 ? "E" : `${relative > 0 ? "+" : ""}${relative}`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-emerald-100/60">
          {activeRound.rulesJson.windSpeedMph} mph wind ·{" "}
          {activeRound.rulesJson.competition
            ? "competition rules"
            : activeRound.rulesJson.mulligansAllowed
              ? "casual mulligans"
              : "no mulligans"}{" "}
          ·{" "}
          {activeRound.rulesJson.greenRule === "manual_putts"
            ? puttingVerified
              ? "playable surveyed putting"
              : "playable approximate putting"
            : "automatic putt-out on mapped greens"}
        </p>
        {activeRound.mode === "play" ? (
          <p className="mt-2 text-xs leading-5 text-amber-100/75">
            Strategy tool only. This test round and its modelled shots are not added to Rounds,
            Shots or performance stats.
          </p>
        ) : null}
        {activeRound.mode !== mode ? (
          <p className="mt-3 rounded-lg border border-amber-200/20 bg-amber-100/5 px-3 py-2 text-xs text-amber-100/80">
            Finish the active {activeRound.mode === "play" ? "My Bag" : "Live"} round before
            starting this mode.
          </p>
        ) : null}
        {sync.status === "error" ? (
          <div className="mt-3 rounded-lg border border-rose-200/20 bg-rose-100/5 p-3 text-xs text-rose-100/85">
            <p>{sync.error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onRetry}>
              Retry save
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const completed = activeRound?.status === "complete";
  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
        {completed
          ? activeRound?.mode === "play"
            ? "Sandbox complete"
            : "Round saved"
          : mode === "play"
            ? "Start My Bag test round"
            : "Start Live round"}
      </p>
      {completed ? (
        <div className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-100/80">
          <p>
            {activeRound.mode === "play"
              ? "The test remains inside Course Twin for strategy review and is not included in your Rounds, Shots or stats."
              : "Every measured shot is saved with a tamper-evident event chain."}
          </p>
          {activeRound.mode === "live" && activeRound.sessionId ? (
            <a
              className="mt-2 inline-block font-semibold text-[#e7ff6a] underline"
              href={`/rounds/${activeRound.sessionId}`}
            >
              View saved round
            </a>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
        Holes
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {([18, 9] as const).map((count) => (
          <button
            key={count}
            type="button"
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-semibold",
              count === holeCount
                ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                : "border-white/10 bg-white/5",
            )}
            onClick={() => {
              onHoleCountChange(count);
              if (count === 18) onStartingHoleChange(1);
            }}
          >
            {count === 18 ? "18 holes" : "Front 9"}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            "rounded-lg border px-2 py-2 text-xs font-semibold",
            holeCount === 9 && startingHole === 10
              ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
              : "border-white/10 bg-white/5",
          )}
          onClick={() => {
            onHoleCountChange(9);
            onStartingHoleChange(10);
          }}
        >
          Back 9
        </button>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
        Wind
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[0, 8, 15].map((speed) => (
          <button
            key={speed}
            type="button"
            className={cn(
              "rounded-lg border px-2 py-2 text-xs font-semibold",
              rules.windSpeedMph === speed
                ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                : "border-white/10 bg-white/5",
            )}
            onClick={() => onRulesChange({ ...rules, windSpeedMph: speed })}
          >
            {speed === 0 ? "Calm" : `${speed} mph`}
          </button>
        ))}
      </div>
      {rules.windSpeedMph > 0 ? (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[
            ["N", 0],
            ["E", 90],
            ["S", 180],
            ["W", 270],
          ].map(([label, direction]) => (
            <button
              key={label}
              type="button"
              className={cn(
                "rounded-lg border px-2 py-2 text-xs font-semibold",
                rules.windDirectionDeg === direction
                  ? "border-emerald-300 bg-emerald-300/15"
                  : "border-white/10 bg-white/5",
              )}
              onClick={() => onRulesChange({ ...rules, windDirectionDeg: Number(direction) })}
            >
              From {label}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
        Round rules
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(
            "rounded-lg border px-2 py-2 text-xs font-semibold",
            !rules.competition
              ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
              : "border-white/10 bg-white/5",
          )}
          onClick={() =>
            onRulesChange({
              ...rules,
              competition: false,
              greenRule: "automatic_putts",
            })
          }
        >
          Casual
        </button>
        <button
          type="button"
          className={cn(
            "rounded-lg border px-2 py-2 text-xs font-semibold",
            rules.competition
              ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
              : "border-white/10 bg-white/5",
          )}
          onClick={() =>
            onRulesChange({
              ...rules,
              competition: true,
              mulligansAllowed: false,
              greenRule: "competition_gimmes",
            })
          }
        >
          Competition
        </button>
      </div>
      {!rules.competition ? (
        <>
          {mode === "play" ? (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
                On the green
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-semibold",
                    rules.greenRule === "automatic_putts"
                      ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                      : "border-white/10 bg-white/5",
                  )}
                  onClick={() => onRulesChange({ ...rules, greenRule: "automatic_putts" })}
                >
                  Auto putt-out
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-semibold",
                    rules.greenRule === "manual_putts"
                      ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                      : "border-white/10 bg-white/5",
                  )}
                  onClick={() => onRulesChange({ ...rules, greenRule: "manual_putts" })}
                >
                  Play putts
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-100/70">
                {puttingVerified
                  ? "Uses the reviewed high-resolution green survey."
                  : "Uses the mapped Grade B green contour and is approximate, not survey-grade."}
              </p>
            </>
          ) : null}
          <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-sm">
            <span>Allow mulligans</span>
            <input
              type="checkbox"
              checked={rules.mulligansAllowed}
              onChange={(event) =>
                onRulesChange({ ...rules, mulligansAllowed: event.target.checked })
              }
            />
          </label>
        </>
      ) : null}
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={sync.status === "saving"}
        onClick={onStart}
      >
        {sync.status === "saving"
          ? "Starting…"
          : completed
            ? `Start another ${mode === "play" ? "My Bag" : "Live"} round`
            : `Start ${holeCount}-hole ${mode === "play" ? "My Bag" : "Live"} round`}
      </Button>
      {sync.status === "error" ? (
        <p className="mt-3 text-xs leading-5 text-rose-100/85">{sync.error}</p>
      ) : null}
    </div>
  );
}

function ManualPuttingControls({
  hole,
  start,
  puttNumber,
  strokes,
  aimOffsetDeg,
  pacePercent,
  result,
  playback,
  sync,
  verified,
  onAimChange,
  onPaceChange,
  onPlay,
  onContinue,
  onRetry,
}: {
  hole: CourseTwinHole;
  start: CourseTwinPoint;
  puttNumber: number;
  strokes: number;
  aimOffsetDeg: number;
  pacePercent: number;
  result: CourseTwinPuttResult | null;
  playback: number;
  sync: RoundSyncState;
  verified: boolean;
  onAimChange: (value: number) => void;
  onPaceChange: (value: number) => void;
  onPlay: () => void;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const distanceM = Math.hypot(hole.green[0] - start[0], hole.green[2] - start[2]);
  const distanceFt = distanceM * 3.280_84;
  return (
    <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
            {verified ? "Surveyed green" : "Approximate green"} · putt {puttNumber}
          </p>
          <p className="mt-2 text-lg font-semibold">
            {distanceFt < 10 ? distanceFt.toFixed(1) : distanceFt.toFixed(0)} ft to the cup
          </p>
          <p className="text-sm text-emerald-100/60">{strokes} strokes played</p>
        </div>
        <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
          Putter
        </Badge>
      </div>

      {result ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#e7ff6a]" style={{ width: `${playback * 100}%` }} />
          </div>
          {playback < 1 ? (
            <p className="mt-3 text-xs text-emerald-100/60">Putt rolling over the contour…</p>
          ) : result.holed ? (
            <div
              className="mt-3 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100"
              role="status"
              aria-live="polite"
            >
              <p className="font-semibold">Holed</p>
              <p className="mt-1 text-xs text-emerald-100/65">
                Saving the putting event and advancing to the next hole…
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ReplayFact
                  label="Putt length"
                  value={`${(result.totalDistanceM * 3.280_84).toFixed(1)} ft`}
                />
                <ReplayFact
                  label="Leave"
                  value={`${(result.remainingDistanceM * 3.280_84).toFixed(1)} ft`}
                />
              </div>
              <Button
                type="button"
                className="mt-3 w-full"
                disabled={sync.status !== "ready"}
                onClick={onContinue}
              >
                {sync.status === "saving" ? "Saving putt…" : "Read next putt"}
              </Button>
            </>
          )}
          {sync.status === "error" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={onRetry}
            >
              Retry saving this putt
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
            Aim
          </p>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {[-6, -3, 0, 3, 6].map((offset) => (
              <button
                key={offset}
                type="button"
                className={cn(
                  "rounded-lg border px-1 py-2 text-xs font-semibold",
                  aimOffsetDeg === offset
                    ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                    : "border-white/10 bg-white/5",
                )}
                aria-label={`Aim putt ${offset === 0 ? "at the cup" : `${Math.abs(offset)} degrees ${offset < 0 ? "left" : "right"}`}`}
                onClick={() => onAimChange(offset)}
              >
                {offset === 0 ? "Cup" : `${offset > 0 ? "+" : ""}${offset}°`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
            Pace
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              [88, "Die"],
              [100, "Cup"],
              [112, "Firm"],
            ].map(([pace, label]) => (
              <button
                key={pace}
                type="button"
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-semibold",
                  pacePercent === pace
                    ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                    : "border-white/10 bg-white/5",
                )}
                onClick={() => onPaceChange(Number(pace))}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={sync.status === "saving"}
            onClick={onPlay}
          >
            Play putt
          </Button>
          <p className="mt-3 text-xs leading-5 text-amber-100/70">
            {verified
              ? "Break and pace use the reviewed high-resolution putting grid."
              : "Break and pace use the mapped terrain. Treat this Grade B result as approximate."}
          </p>
        </>
      )}
    </div>
  );
}

function VirtualRoundControls({
  state,
  hole,
  selectedClub,
  availableClubs,
  lieSurface,
  shotKind,
  shotKindOptions,
  onShotKindChange,
  onSelectClub,
  start,
  aimDirectionDeg,
  onAimDirectionChange,
  shotNumber,
  strokes,
  penaltyStrokes,
  shot,
  simulation,
  playback,
  sync,
  rules,
  onPlay,
  onContinue,
  onMulligan,
  onRetry,
  onStrategyRetry,
}: {
  state: StrategyLoadState;
  hole: CourseTwinHole;
  selectedClub: CourseTwinStrategyClub | null;
  availableClubs: CourseTwinStrategyClub[];
  lieSurface: CourseTwinSurface;
  shotKind: CourseTwinVirtualShotKind;
  shotKindOptions: CourseTwinVirtualShotKind[];
  onShotKindChange: (kind: CourseTwinVirtualShotKind) => void;
  onSelectClub: (clubId: string) => void;
  start: CourseTwinPoint;
  aimDirectionDeg: number;
  onAimDirectionChange: (directionDeg: number) => void;
  shotNumber: number;
  strokes: number;
  penaltyStrokes: number;
  shot: CourseTwinVirtualShot | null;
  simulation: CourseTwinReplaySimulation | null;
  playback: number;
  sync: RoundSyncState["status"];
  rules: CourseTwinRoundRules;
  onPlay: () => void;
  onContinue: () => void;
  onMulligan: () => void;
  onRetry: () => void;
  onStrategyRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
          Virtual round · My Bag
        </p>
        <p className="mt-3 text-sm leading-6 text-emerald-100/60">
          Loading your measured club distributions…
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mt-5 rounded-xl border border-amber-200/20 bg-amber-100/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/70">
          My Bag play unavailable
        </p>
        <p className="mt-3 text-sm leading-6 text-amber-50/70">{state.error}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 !border-white/15 !bg-transparent !text-white hover:!bg-white/10"
          onClick={onStrategyRetry}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (!state.document || !selectedClub) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-emerald-100/60">
        Play needs a measured bag profile from imported launch-monitor shots.
      </div>
    );
  }

  const resultPosition = simulation?.finalPosition ?? {
    x: start[0],
    y: start[1],
    z: start[2],
  };
  const remainingYd =
    Math.hypot(hole.green[0] - resultPosition.x, hole.green[2] - resultPosition.z) / 0.9144;
  const onGreen = simulation?.finalSurface === "green";
  const shortGameActive = shotKind !== "full";
  const aimLimitDeg = courseTwinAimLimitDeg(shotKind);
  const effectiveAimDirectionDeg = THREE.MathUtils.clamp(
    aimDirectionDeg,
    -aimLimitDeg,
    aimLimitDeg,
  );

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
            Virtual round · My Bag
          </p>
          <p className="mt-2 text-lg font-semibold">Shot {shotNumber}</p>
          <p className="text-sm text-emerald-100/60">
            {strokes} {strokes === 1 ? "stroke" : "strokes"}
            {penaltyStrokes > 0 ? ` · ${penaltyStrokes} penalty` : ""}
          </p>
          <p className="mt-1 text-xs text-emerald-100/50">
            {remainingYd.toFixed(0)} yd to mapped pin
          </p>
        </div>
        <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
          Par {hole.par}
        </Badge>
      </div>

      {shot && simulation ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#e7ff6a]" style={{ width: `${playback * 100}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <ReplayFact label="Club" value={shot.shot.clubType} />
            <ReplayFact label="Shot" value={formatVirtualShotKind(shot.sampled.shotKind)} />
            <ReplayFact label="Sampled" value={`${shot.sampled.carryYd.toFixed(0)} yd carry`} />
            <ReplayFact
              label="Started"
              value={
                Math.abs(shot.sampled.aimDirectionDeg) < 0.05
                  ? "Target line"
                  : `${Math.abs(shot.sampled.aimDirectionDeg).toFixed(1)}° ${
                      shot.sampled.aimDirectionDeg < 0 ? "left" : "right"
                    }`
              }
            />
            <ReplayFact label="Shape" value={formatVirtualShape(shot.sampled.spinAxisDeg)} />
            <ReplayFact
              label="Shape source"
              value={
                shot.sampled.shapeSource === "measured-spin-axis"
                  ? "Measured axis"
                  : "Dispersion inferred"
              }
            />
            <ReplayFact
              label={simulation.penalty ? "Penalty" : "Lie"}
              value={
                simulation.penalty
                  ? formatPenalty(simulation.penalty)
                  : formatSurface(simulation.finalSurface)
              }
              alert={Boolean(simulation.penalty)}
            />
            <ReplayFact label="Remaining" value={`${remainingYd.toFixed(0)} yd`} />
          </div>
          {playback >= 1 ? (
            <>
              {onGreen && !simulation.penalty ? (
                rules.greenRule === "manual_putts" ? (
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    disabled={sync !== "ready"}
                    onClick={onContinue}
                  >
                    {sync === "saving" ? "Saving green position…" : "Read putt"}
                  </Button>
                ) : (
                  <RoundAutoPuttStatus remainingYd={remainingYd} saving={sync === "saving"} />
                )
              ) : (
                <Button
                  type="button"
                  className="mt-3 w-full"
                  disabled={sync !== "ready"}
                  onClick={onContinue}
                >
                  {sync === "saving"
                    ? "Saving shot…"
                    : simulation.penalty
                      ? "Take penalty drop"
                      : "Play next shot"}
                </Button>
              )}
              {rules.mulligansAllowed ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full !border-white/15 !bg-transparent !text-white hover:!bg-white/10"
                  disabled={sync !== "ready"}
                  onClick={onMulligan}
                >
                  Mulligan
                </Button>
              ) : null}
              {sync === "error" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={onRetry}
                >
                  Retry saving this shot
                </Button>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-xs text-emerald-100/50">Shot in progress…</p>
          )}
        </>
      ) : (
        <>
          {shotKindOptions.length > 1 ? (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
                Shot type
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {shotKindOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-semibold",
                      option === shotKind
                        ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                        : "border-white/10 bg-white/5",
                    )}
                    aria-label={`Select ${formatVirtualShotKind(option).toLowerCase()}`}
                    onClick={() => onShotKindChange(option)}
                  >
                    {formatVirtualShotKind(option)}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {shortGameActive ? (
            <div className="mt-3 rounded-lg border border-sky-200/20 bg-sky-100/5 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-100/80">
                {formatVirtualShotKind(shotKind)} · {formatSurface(lieSurface)}
              </p>
              <p className="mt-1 text-xs leading-5 text-sky-50/65">
                Carry is scaled to this {remainingYd.toFixed(0)} yd leave. The mapped landing
                surface controls bounce and rollout.
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {availableClubs.map((club) => (
              <button
                key={club.clubId}
                type="button"
                className={cn(
                  "min-w-fit rounded-lg border px-3 py-2 text-sm font-semibold",
                  club.clubId === selectedClub.clubId
                    ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                    : "border-white/10 bg-white/5",
                )}
                aria-label={`Select ${club.clubType} for virtual shot`}
                onClick={() => onSelectClub(club.clubId)}
              >
                {club.clubType}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
                Start direction
              </p>
              <p className="mt-1 text-xs text-emerald-100/50">
                Click the course or move the slider
              </p>
            </div>
            <p className="text-sm font-semibold text-[#e7ff6a]">
              {Math.abs(effectiveAimDirectionDeg) < 0.05
                ? "Target line"
                : `${Math.abs(effectiveAimDirectionDeg).toFixed(1)}° ${
                    effectiveAimDirectionDeg < 0 ? "left" : "right"
                  }`}
            </p>
          </div>
          <input
            className="mt-3 w-full accent-[#e7ff6a]"
            type="range"
            min={-aimLimitDeg}
            max={aimLimitDeg}
            step={0.5}
            value={effectiveAimDirectionDeg}
            aria-label="Shot start direction"
            onChange={(event) => onAimDirectionChange(Number(event.target.value))}
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold"
              aria-label="Aim five degrees left"
              onClick={() =>
                onAimDirectionChange(Math.max(-aimLimitDeg, effectiveAimDirectionDeg - 5))
              }
            >
              5° left
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg border px-2 py-2 text-xs font-semibold",
                Math.abs(effectiveAimDirectionDeg) < 0.05
                  ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                  : "border-white/10 bg-white/5",
              )}
              aria-label="Aim at mapped target"
              onClick={() => onAimDirectionChange(0)}
            >
              Centre
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold"
              aria-label="Aim five degrees right"
              onClick={() =>
                onAimDirectionChange(Math.min(aimLimitDeg, effectiveAimDirectionDeg + 5))
              }
            >
              5° right
            </button>
          </div>
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={sync === "saving"}
            onClick={onPlay}
            aria-label={`Play ${selectedClub.clubType}`}
          >
            {shortGameActive
              ? `Play ${formatVirtualShotKind(shotKind).toLowerCase()} · ${selectedClub.clubType}`
              : `Play ${selectedClub.clubType}`}
          </Button>
          <p className="mt-3 text-xs leading-5 text-amber-100/70">
            {shortGameActive
              ? "Short-game strike variation is modelled from the selected scoring club and current lie."
              : selectedClub.shotModel.spinAxisMeanDeg !== null
                ? "Each shot samples your measured carry, dispersion and spin-axis shape."
                : "Your imported shots do not contain spin axis, so curve is inferred from measured left/right dispersion."}{" "}
            This remains a model, not a guaranteed result.
          </p>
        </>
      )}
    </div>
  );
}

function LiveRoundControls({
  bridge,
  pairingCode,
  onPairingCodeChange,
  onDetect,
  onPair,
  onDownloadDiagnostics,
  hole,
  strategy,
  selectedClub,
  onSelectClub,
  handed,
  onHandedChange,
  shotNumber,
  strokes,
  penaltyStrokes,
  shot,
  simulation,
  playback,
  sync,
  rules,
  onContinue,
  onMulligan,
  onRetry,
}: {
  bridge: BridgeLoadState;
  pairingCode: string;
  onPairingCodeChange: (code: string) => void;
  onDetect: () => void;
  onPair: () => void;
  onDownloadDiagnostics: () => void;
  hole: CourseTwinHole;
  strategy: StrategyLoadState;
  selectedClub: CourseTwinStrategyClub | null;
  onSelectClub: (clubId: string) => void;
  handed: "RH" | "LH";
  onHandedChange: (handed: "RH" | "LH") => void;
  shotNumber: number;
  strokes: number;
  penaltyStrokes: number;
  shot: CourseTwinReplayShot | null;
  simulation: CourseTwinReplaySimulation | null;
  playback: number;
  sync: RoundSyncState["status"];
  rules: CourseTwinRoundRules;
  onContinue: () => void;
  onMulligan: () => void;
  onRetry: () => void;
}) {
  const connected = bridge.status === "connected";
  const resultPosition = simulation?.finalPosition;
  const remainingYd = resultPosition
    ? Math.hypot(hole.green[0] - resultPosition.x, hole.green[2] - resultPosition.z) / 0.9144
    : null;
  const onGreen = simulation?.finalSurface === "green";

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/60">
            Live launch monitor
          </p>
          <p className="mt-2 text-lg font-semibold">
            {connected
              ? bridge.launchMonitorConnected
                ? "Ready for shot"
                : "Bridge paired"
              : "Local bridge"}
          </p>
          <p className="text-sm text-emerald-100/60">
            {connected
              ? bridge.launchMonitorConnected
                ? "GSPro feed detected on this computer"
                : "Waiting for the launch monitor in GSPro mode"
              : "Loopback only · no monitor data leaves this computer"}
          </p>
        </div>
        <div
          className={cn(
            "grid size-9 place-items-center rounded-full border",
            connected
              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
              : "border-white/10 bg-white/5 text-white/45",
          )}
          aria-label={connected ? "Bridge connected" : "Bridge disconnected"}
        >
          {connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
        </div>
      </div>

      {bridge.status === "detecting" ? (
        <p className="mt-4 text-sm text-emerald-100/60">Looking for Course Twin Bridge…</p>
      ) : bridge.status === "available" || bridge.status === "pairing" ? (
        <div className="mt-4">
          <label
            htmlFor="course-twin-pairing-code"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60"
          >
            Six-digit pairing code
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="course-twin-pairing-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pairingCode}
              onChange={(event) =>
                onPairingCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/20 px-3 py-2 font-mono text-lg tracking-[0.22em] text-white outline-none focus:border-emerald-300"
              placeholder="000000"
            />
            <Button type="button" disabled={bridge.status === "pairing"} onClick={onPair}>
              {bridge.status === "pairing" ? "Pairing…" : "Pair"}
            </Button>
          </div>
        </div>
      ) : !connected ? (
        <Button type="button" className="mt-4 w-full" onClick={onDetect}>
          Find local bridge
        </Button>
      ) : null}

      {bridge.error ? (
        <div className="mt-3 rounded-lg border border-amber-200/20 bg-amber-100/5 px-3 py-2 text-xs leading-5 text-amber-100/80">
          {bridge.error}
        </div>
      ) : null}

      {bridge.health || connected ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={onDownloadDiagnostics}
        >
          Download connection report
        </Button>
      ) : null}

      {connected ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/60">
                Hole {hole.holeNumber} · shot {shotNumber}
              </p>
              <p className="mt-1 text-sm text-emerald-100/60">
                {strokes} {strokes === 1 ? "stroke" : "strokes"}
                {penaltyStrokes > 0 ? ` · ${penaltyStrokes} penalty` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/15 p-1">
              {(["RH", "LH"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-xs font-semibold",
                    handed === value ? "bg-[#e7ff6a] text-[#102217]" : "text-white/60",
                  )}
                  onClick={() => onHandedChange(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {shot && simulation ? (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-[#e7ff6a]" style={{ width: `${playback * 100}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ReplayFact label="Club" value={shot.clubType} />
                <ReplayFact
                  label="Ball speed"
                  value={`${shot.metrics.ballSpeedMph.value?.toFixed(1)} mph`}
                />
                <ReplayFact
                  label={simulation.penalty ? "Penalty" : "Lie"}
                  value={
                    simulation.penalty
                      ? formatPenalty(simulation.penalty)
                      : formatSurface(simulation.finalSurface)
                  }
                  alert={Boolean(simulation.penalty)}
                />
                <ReplayFact label="Remaining" value={`${remainingYd?.toFixed(0)} yd`} />
              </div>
              {playback >= 1 ? (
                <>
                  {onGreen && !simulation.penalty ? (
                    <RoundAutoPuttStatus
                      remainingYd={remainingYd ?? 0}
                      saving={sync === "saving"}
                    />
                  ) : (
                    <Button
                      type="button"
                      className="mt-3 w-full"
                      disabled={sync !== "ready"}
                      onClick={onContinue}
                    >
                      {sync === "saving"
                        ? "Saving shot…"
                        : simulation.penalty
                          ? "Take penalty drop"
                          : "Ready for next shot"}
                    </Button>
                  )}
                  {rules.mulligansAllowed ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full !border-white/15 !bg-transparent !text-white hover:!bg-white/10"
                      disabled={sync !== "ready"}
                      onClick={onMulligan}
                    >
                      Mulligan
                    </Button>
                  ) : null}
                  {sync === "error" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={onRetry}
                    >
                      Retry saving this shot
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-xs text-emerald-100/50">Simulating measured shot…</p>
              )}
            </>
          ) : strategy.status === "loading" ? (
            <p className="mt-3 text-sm text-emerald-100/60">Loading your measured bag…</p>
          ) : selectedClub && strategy.document ? (
            <>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {strategy.document.clubs.map((club) => (
                  <button
                    key={club.clubId}
                    type="button"
                    className={cn(
                      "min-w-fit rounded-lg border px-3 py-2 text-sm font-semibold",
                      club.clubId === selectedClub.clubId
                        ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                        : "border-white/10 bg-white/5",
                    )}
                    aria-label={`Tell launch monitor ${club.clubType} is selected`}
                    onClick={() => onSelectClub(club.clubId)}
                  >
                    {club.clubType}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-xs text-emerald-100/75">
                <Radio className="size-4 shrink-0 text-emerald-300" />
                Hit {selectedClub.clubType} when the monitor reports ready. Only the next shot will
                be shown.
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-amber-100/70">
              Live play needs a measured bag profile so Course Twin can send the selected club to
              GSPro.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RoundAutoPuttStatus({ remainingYd, saving }: { remainingYd: number; saving: boolean }) {
  const putts = courseTwinAutomaticPuttCount(remainingYd);
  return (
    <div
      className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-sm text-emerald-100/80"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">Green reached · automatic putt-out</p>
      <p className="mt-1 text-xs text-emerald-100/60">
        {putts} modelled {putts === 1 ? "putt" : "putts"} added
        {saving ? " · saving and advancing…" : " · advancing to the next hole…"}
      </p>
      <p className="mt-1 text-xs text-emerald-100/50">
        10 ft or less counts as one putt; farther away counts as two.
      </p>
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

function terrainSurfacePoint(
  point: CourseTwinPoint,
  sampleTerrain: CourseTwinTerrainSampler,
  lift = 0,
): [number, number, number] {
  return [point[0], sampleTerrain(point[0], point[2]) + lift, point[2]];
}

function setPerspectiveFov(camera: THREE.PerspectiveCamera, fov: number) {
  const focalLength =
    (0.5 * camera.getFilmHeight()) / Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
  camera.setFocalLength(focalLength);
}

function formatYards(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function formatSurface(surface: CourseTwinSurface) {
  return surface
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPenalty(penalty: NonNullable<CourseTwinReplaySimulation["penalty"]>) {
  return penalty === "water" ? "Water" : "Out of bounds";
}

function formatVirtualShape(spinAxisDeg: number) {
  const magnitude = Math.abs(spinAxisDeg);
  if (magnitude < 0.1) return "Straight";
  const strength = magnitude < 4 ? "Soft" : magnitude < 9 ? "Shaped" : "Strong";
  return `${strength} ${spinAxisDeg > 0 ? "left" : "right"} · ${magnitude.toFixed(1)}°`;
}

function formatVirtualShotKind(kind: CourseTwinVirtualShotKind) {
  if (kind === "bunker-splash") return "Bunker splash";
  if (kind === "half") return "Half shot";
  if (kind === "full") return "Full swing";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

function strategyConfidenceCopy(club: CourseTwinStrategyClub) {
  if (club.confidence === "measured") {
    return `Measured confidence (${Math.round(club.confidenceScore)}%).`;
  }
  if (club.confidence === "developing") {
    return `Developing confidence from ${club.sampleSize} measured shots.`;
  }
  return `Low sample: only ${club.sampleSize} measured shots.`;
}

function virtualDropPoint(simulation: CourseTwinReplaySimulation) {
  if (!simulation.penalty) return simulation.finalPosition;
  return (
    [...simulation.frames]
      .reverse()
      .find((frame) => frame.surface !== "water" && frame.surface !== "out_of_bounds")?.position ??
    simulation.carryPosition
  );
}

function courseTwinWindVector(rules: CourseTwinRoundRules) {
  const speedMps = rules.windSpeedMph * 0.44704;
  const flowBearingRadians = THREE.MathUtils.degToRad((rules.windDirectionDeg + 180) % 360);
  return {
    x: Math.sin(flowBearingRadians) * speedMps,
    y: 0,
    z: -Math.cos(flowBearingRadians) * speedMps,
  };
}

function buildRoundShotPayload({
  shot,
  simulation,
  clubId,
  source,
  ledgerHoleNumber,
}: {
  shot: CourseTwinReplayShot;
  simulation: CourseTwinReplaySimulation;
  clubId: string;
  source: CourseTwinShotEventPayload["source"];
  ledgerHoleNumber: number;
}): CourseTwinShotEventPayload {
  return {
    holeNumber: ledgerHoleNumber,
    shotNumber: shot.holeShotNumber ?? 1,
    clubId,
    clubType: shot.clubType,
    source,
    start: shot.start,
    carryEnd: [simulation.carryPosition.x, simulation.carryPosition.y, simulation.carryPosition.z],
    totalEnd: [simulation.finalPosition.x, simulation.finalPosition.y, simulation.finalPosition.z],
    metrics: {
      carryYd: simulation.carryDistanceM / 0.9144,
      totalYd: simulation.totalDistanceM / 0.9144,
      ballSpeedMph: shot.metrics.ballSpeedMph.value,
      clubSpeedMph: null,
      launchAngleDeg: shot.metrics.launchAngleDeg.value,
      launchDirectionDeg: shot.metrics.launchDirectionDeg?.value ?? null,
      spinRate: shot.metrics.spinRate.value,
      spinAxis: shot.metrics.spinAxis.value,
    },
    result: {
      finalSurface: simulation.finalSurface,
      penalty: simulation.penalty,
      bounceCount: simulation.bounceCount,
    },
  };
}
