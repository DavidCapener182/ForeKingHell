"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdaptiveDpr,
  Line,
  OrbitControls,
  PerformanceMonitor,
  useTexture,
} from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CarFront,
  CirclePause,
  CirclePlay,
  BarChart3,
  LocateFixed,
  Footprints,
  Copy,
  LogOut,
  Users,
  Radio,
  Radar,
  RotateCcw,
  Settings,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  X,
} from "lucide-react";

import mobileStyles from "@/app/play/[courseId]/course-twin-mobile.module.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { courseTwinHighDetailRuntimeUrl } from "@/lib/course-twin-imagery";
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
import type { CourseTwinRenderQuality } from "@/lib/course-twin-performance";

type RuntimeMode = "flyover" | "replay" | "strategy" | "play" | "live" | "explore";
type ExploreTransport = "walk" | "cart";
type CameraView = "golfer" | "aerial";
type HudPanel = "course" | "analysis" | null;
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
  {
    url: "/course-twins/common/vegetation/high-detail/tree-oak-hq.webp?v=1",
    aspect: 1,
  },
  {
    url: "/course-twins/common/vegetation/high-detail/tree-birch-hq.webp?v=1",
    aspect: 1,
  },
  {
    url: "/course-twins/common/vegetation/high-detail/tree-sycamore-hq.webp?v=1",
    aspect: 1,
  },
] as const;
const bushBillboards = [
  {
    url: "/course-twins/common/vegetation/high-detail/shrub-hawthorn-hq.webp?v=1",
    aspect: 1024 / 683,
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

const highDetailSurfaceMaps = {
  rough: {
    colour: "/course-twins/common/materials/high-detail/Grass001-Color.webp?v=1",
    metresPerTile: pbrSurfaceAssets.rough.metresPerTile,
    visualMetresPerTile: pbrSurfaceAssets.rough.metresPerTile,
  },
  fairway: {
    colour: "/course-twins/common/materials/high-detail/Grass005-Color.webp?v=1",
    metresPerTile: pbrSurfaceAssets.fairway.metresPerTile,
    visualMetresPerTile: pbrSurfaceAssets.fairway.metresPerTile,
  },
  green: {
    colour: "/course-twins/common/materials/high-detail/Grass008-Color.webp?v=1",
    metresPerTile: pbrSurfaceAssets.green.metresPerTile,
    visualMetresPerTile: pbrSurfaceAssets.green.metresPerTile,
  },
  bunker: {
    colour: "/course-twins/common/materials/high-detail/Ground080-Color.webp?v=1",
    metresPerTile: pbrSurfaceAssets.bunker.metresPerTile,
    visualMetresPerTile: pbrSurfaceAssets.bunker.metresPerTile,
  },
} as const;

const highDetailSurfaceNormalAtlas =
  "/course-twins/common/materials/high-detail/course-surface-normal-atlas.webp?v=1";
const highDetailSurfaceRoughnessAtlas =
  "/course-twins/common/materials/high-detail/course-surface-roughness-atlas.webp?v=1";

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

function CourseTwinAdaptiveQuality({
  renderQuality,
}: {
  renderQuality: Exclude<CourseTwinRenderQuality, "fallback">;
}) {
  const setDpr = useThree((state) => state.setDpr);
  const minDpr = renderQuality === "high" ? 1 : 0.75;
  const maxDpr = renderQuality === "high" ? 1.75 : 1.25;

  return (
    <PerformanceMonitor
      factor={renderQuality === "high" ? 0.72 : 0.5}
      flipflops={3}
      onChange={({ factor }) =>
        setDpr(THREE.MathUtils.lerp(minDpr, maxDpr, THREE.MathUtils.clamp(factor, 0, 1)))
      }
      onFallback={() => setDpr(minDpr)}
    >
      <AdaptiveDpr pixelated />
    </PerformanceMonitor>
  );
}

export function CourseTwinScene({
  manifest,
  replay,
  readOnly = false,
  tournamentId,
  tournamentRoundNumber,
  initialMode,
  initialHoleNumber,
  renderQuality,
}: {
  manifest: CourseTwinManifest;
  replay: CourseTwinReplayDocument | null;
  readOnly?: boolean;
  tournamentId?: string | null;
  tournamentRoundNumber?: number | null;
  initialMode?: RuntimeMode;
  initialHoleNumber?: number;
  renderQuality: Exclude<CourseTwinRenderQuality, "fallback">;
}) {
  const initialCompactViewport =
    typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const [holeNumber, setHoleNumber] = useState(
    manifest.holes.some((hole) => hole.holeNumber === initialHoleNumber)
      ? initialHoleNumber!
      : (manifest.holes[0]?.holeNumber ?? 1),
  );
  const [mode, setMode] = useState<RuntimeMode>(
    initialMode ??
      (initialCompactViewport ? "strategy" : replay?.shots.length ? "replay" : "strategy"),
  );
  const [cameraView, setCameraView] = useState<CameraView>(
    initialMode === "strategy" || initialCompactViewport || replay?.shots.length
      ? "aerial"
      : "golfer",
  );
  const [shotIndex, setShotIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState(0);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>(null);
  const [hudPanel, setHudPanel] = useState<HudPanel>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
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
  const hudReturnFocusRef = useRef<HTMLElement | null>(null);
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

  const closeHudPanel = useCallback(() => {
    setHudPanel(null);
    if (!isCompactViewport) return;
    const returnFocus = hudReturnFocusRef.current;
    window.requestAnimationFrame(() => returnFocus?.focus());
  }, [isCompactViewport]);

  const toggleHudPanel = useCallback(
    (panel: Exclude<HudPanel, null>) => {
      if (hudPanel === panel) {
        closeHudPanel();
        return;
      }
      if (isCompactViewport && document.activeElement instanceof HTMLElement) {
        hudReturnFocusRef.current = document.activeElement;
      }
      setHudPanel(panel);
    },
    [closeHudPanel, hudPanel, isCompactViewport],
  );

  const selectMode = (nextMode: RuntimeMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
    const usesDesktopPanels =
      typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    setHudPanel(
      usesDesktopPanels && (nextMode === "play" || nextMode === "live") ? "analysis" : null,
    );
  };

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const updateCompactViewport = () => setIsCompactViewport(media.matches);
    updateCompactViewport();
    media.addEventListener("change", updateCompactViewport);
    return () => media.removeEventListener("change", updateCompactViewport);
  }, []);

  useEffect(() => {
    if (!hudPanel) return;
    const panelSelector =
      hudPanel === "course"
        ? "[data-course-twin-primary-controls]"
        : "[data-course-twin-shot-controls]";
    const panel = document.querySelector<HTMLElement>(panelSelector);
    const focusFrame = isCompactViewport
      ? window.requestAnimationFrame(() => {
          const firstControl = panel?.querySelector<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          (firstControl ?? panel)?.focus();
        })
      : null;
    const handlePanelKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHudPanel();
        return;
      }
      if (!isCompactViewport || event.key !== "Tab" || !panel) return;
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((control) => control.offsetParent !== null);
      if (controls.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handlePanelKeyDown);
    return () => {
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handlePanelKeyDown);
    };
  }, [closeHudPanel, hudPanel, isCompactViewport]);

  const selectedHole =
    manifest.holes.find((hole) => hole.holeNumber === holeNumber) ?? manifest.holes[0];
  const holeShots = useMemo(
    () => replay?.shots.filter((shot) => shot.holeNumber === selectedHole.holeNumber) ?? [],
    [replay?.shots, selectedHole.holeNumber],
  );
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
  const replayCompletedTracers = useMemo(() => {
    if (!sampleTerrain || mode !== "replay") return [];
    return holeShots.slice(0, shotIndex).map((shot, index) => ({
      id: shot.id,
      shotNumber: shot.holeShotNumber ?? index + 1,
      simulation: simulateCourseTwinReplayShot(shot, {
        groundHeight: sampleTerrain,
        surfaceAt: classifySurface,
      }),
    }));
  }, [classifySurface, holeShots, mode, sampleTerrain, shotIndex]);
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
  const virtualClubOptions = useMemo(
    () => courseTwinVirtualClubOptions(strategyState.document?.clubs ?? [], virtualRemainingYd),
    [strategyState.document?.clubs, virtualRemainingYd],
  );
  const virtualStrategyClub =
    virtualClubOptions.find((club) => club.clubId === strategyClubId) ??
    virtualClubOptions[0] ??
    strategyClub;
  const virtualShotKindOptions = courseTwinVirtualShotKindOptions(
    virtualRemainingYd,
    virtualLieSurface,
    virtualStrategyClub?.clubType,
  );
  const virtualShotKind =
    virtualShotKindChoice && virtualShotKindOptions.includes(virtualShotKindChoice)
      ? virtualShotKindChoice
      : courseTwinVirtualShotKind(
          virtualRemainingYd,
          virtualLieSurface,
          virtualStrategyClub?.clubType,
        );
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
        shotNumber: shot.shotNumber,
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

  const loadStrategy = useCallback(
    (nextHoleNumber: number) => {
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
    },
    [manifest.course.id],
  );

  useEffect(() => {
    if (mode !== "strategy" || strategyState.status !== "idle") return;
    const timer = window.setTimeout(() => loadStrategy(selectedHole.holeNumber), 0);
    return () => window.clearTimeout(timer);
  }, [loadStrategy, mode, selectedHole.holeNumber, strategyState.status]);

  const activateRuntimeMode = (nextMode: RuntimeMode) => {
    selectMode(nextMode);
    setPlaying(false);
    setCameraCommand(null);

    if (nextMode === "explore") {
      setExplorePosition(selectedHole.tee);
      return;
    }

    setCameraView(
      nextMode === "strategy" || nextMode === "replay" || nextMode === "flyover"
        ? "aerial"
        : "golfer",
    );
    if (nextMode === "strategy" || nextMode === "play" || nextMode === "live") {
      if (
        strategyState.holeNumber !== selectedHole.holeNumber ||
        strategyState.status === "idle" ||
        strategyState.status === "error"
      ) {
        loadStrategy(selectedHole.holeNumber);
      }
    }
    if (nextMode === "live" && (bridgeState.status === "idle" || bridgeState.status === "error")) {
      detectBridge();
    }
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
    const roomId = roomState.room?.id;
    setRoomState({ status: "loading", room: null, error: null });
    setRoomInviteCode("");

    if (!roomId) {
      setRoomState({ status: "idle", room: null, error: null });
      return;
    }

    try {
      const response = await fetch(`/api/course-twins/rooms/${roomId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to leave the group session.");
      setRoomState({ status: "idle", room: null, error: null });
    } catch (error) {
      setRoomState({
        status: "error",
        room: null,
        error: error instanceof Error ? error.message : "Unable to leave the group session.",
      });
    }
  };

  const playVirtualShot = () => {
    if (!virtualStrategyClub || roundSync.status === "saving") return;
    if (activeRound && selectedHole.holeNumber !== activeRoundPhysicalHoleNumber) {
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
  };

  const continueVirtualShot = () => {
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
  };

  const playVirtualPutt = () => {
    if (!virtualPuttStart || !sampleTerrain || roundSync.status === "saving") return;
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
  };

  const continueVirtualPutt = () => {
    if (!virtualPuttResult || roundSync.status !== "ready") return;
    setVirtualPuttNumber((current) => current + 1);
    setVirtualPuttResult(null);
    setVirtualPuttEventId(null);
    setPlayback(0);
    setPlaying(false);
    setCameraCommand(null);
  };

  const continueLiveShot = () => {
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
  };

  const mobileHoleStatus = (() => {
    if (mode === "play") {
      if (activeRound?.mode !== "play" || activeRound.status !== "in_progress") {
        return "Modelled My Bag round";
      }
      if (manualPuttingVisible && !virtualShot && virtualPuttStart) {
        const puttDistanceFt =
          Math.hypot(
            selectedHole.green[0] - virtualPuttStart[0],
            selectedHole.green[2] - virtualPuttStart[2],
          ) * 3.280_84;
        return `Putt ${virtualPuttNumber} · ${puttDistanceFt < 10 ? puttDistanceFt.toFixed(1) : puttDistanceFt.toFixed(0)} ft · Modelled`;
      }
      if (virtualShot) {
        return `${virtualShot.shot.clubType} · ${virtualShot.sampled.carryYd.toFixed(0)} yd · Modelled`;
      }
      return `Shot ${virtualShotNumber} · ${virtualRemainingYd.toFixed(0)} yd · ${formatMobileAim(virtualAimDirectionDeg)} · Modelled`;
    }
    if (mode === "replay") return "Measured launch · reconstructed flight";
    if (mode === "strategy") return "Modelled plan from measured shots";
    if (mode === "live") return "Measured launch · reconstructed placement";
    if (mode === "explore") return "Mapped terrain · touch controls";
    return "Mapped course view";
  })();

  const mobileActionContent: ReactNode =
    mode === "play" ? (
      activeRound?.mode === "play" && activeRound.status === "in_progress" ? (
        manualPuttingVisible && !virtualShot && virtualPuttStart ? (
          <MobilePuttingControls
            hole={selectedHole}
            start={virtualPuttStart}
            puttNumber={virtualPuttNumber}
            strokes={virtualStrokes}
            aimOffsetDeg={virtualPuttAimDeg}
            pacePercent={virtualPuttPacePercent}
            result={virtualPuttResult}
            playback={playback}
            sync={roundSync.status}
            verified={manifest.quality.grade === "A" && manifest.quality.verified}
            onAimChange={setVirtualPuttAimDeg}
            onPaceChange={setVirtualPuttPacePercent}
            onPlay={playVirtualPutt}
            onContinue={continueVirtualPutt}
          />
        ) : (
          <MobileVirtualRoundControls
            state={strategyState}
            hole={selectedHole}
            selectedClub={virtualStrategyClub}
            availableClubs={virtualClubOptions}
            shotKind={virtualShotKind}
            shotKindOptions={virtualShotKindOptions}
            onShotKindChange={(kind) => {
              setVirtualShotKindChoice(kind);
              setVirtualAimDirectionDeg(0);
            }}
            onSelectClub={setStrategyClubId}
            aimDirectionDeg={virtualAimDirectionDeg}
            onAimDirectionChange={setVirtualAimDirectionDeg}
            shotNumber={virtualShotNumber}
            strokes={virtualStrokes}
            remainingYd={virtualRemainingYd}
            shot={virtualShot}
            simulation={virtualSimulation}
            playback={playback}
            sync={roundSync.status}
            onPlay={playVirtualShot}
            onContinue={continueVirtualShot}
            onOpenDetails={() => toggleHudPanel("analysis")}
          />
        )
      ) : (
        <MobileSummaryTray
          title={activeRound?.status === "complete" ? "Round complete" : "My Bag round"}
          detail="Choose the round rules, then play every shot over the mapped course."
          evidence="Shots are modelled from measured bag evidence, not guaranteed outcomes."
          actionLabel="Set up round"
          onAction={() => toggleHudPanel("analysis")}
        />
      )
    ) : mode === "replay" ? (
      <MobileReplayControls
        shot={selectedShot}
        playing={playing}
        playback={playback}
        onToggle={() => {
          if (playback >= 1) setPlayback(0);
          setPlaying((current) => !current);
        }}
        onOpenDetails={() => toggleHudPanel("analysis")}
      />
    ) : mode === "strategy" ? (
      <MobileStrategyControls
        state={strategyState}
        selectedClub={strategyClub}
        onSelectClub={setStrategyClubId}
        onOpenDetails={() => toggleHudPanel("analysis")}
      />
    ) : mode === "live" ? (
      <MobileLiveControls
        bridge={bridgeState}
        pairingCode={pairingCode}
        strategy={strategyState}
        selectedClub={strategyClub}
        shot={liveShot}
        simulation={liveSimulation}
        playback={playback}
        sync={roundSync.status}
        roundActive={activeRound?.mode === "live" && activeRound.status === "in_progress"}
        onPairingCodeChange={setPairingCode}
        onDetect={detectBridge}
        onPair={pairBridge}
        onSelectClub={setStrategyClubId}
        onContinue={continueLiveShot}
        onOpenDetails={() => toggleHudPanel("analysis")}
      />
    ) : mode === "explore" ? (
      <MobileExploreControls transport={exploreTransport} onTransportChange={setExploreTransport} />
    ) : (
      <MobileSummaryTray
        title="Course flyover"
        detail="Drag to orbit and pinch to inspect the mapped hole."
        evidence="Terrain and hole geometry are mapped; screening foliage completes course context."
      />
    );

  const hudStrategyClub = mode === "play" ? virtualStrategyClub : strategyClub;
  const hudClub =
    mode === "replay" ? (selectedShot?.clubType ?? "—") : (hudStrategyClub?.clubType ?? "—");
  const hudCarryYd =
    mode === "replay"
      ? (selectedShot?.metrics.carryYd.value ?? null)
      : mode === "play" && virtualShot
        ? virtualShot.sampled.carryYd
        : (hudStrategyClub?.carryMedianYd ?? null);
  const hudTarget =
    mode === "play"
      ? formatMobileAim(virtualAimDirectionDeg)
      : mode === "strategy" && strategyClub
        ? formatStrategyTarget(strategyClub.aimOffsetYd)
        : "Mapped target";
  const hudMissPattern = formatStrategyMissPattern(hudStrategyClub);
  const hudCurrent =
    mode === "replay"
      ? selectedShot
        ? `Shot ${selectedShot.holeShotNumber ?? shotIndex + 1} · measured replay`
        : "No measured replay on this hole"
      : mode === "play"
        ? virtualShot
          ? `${formatVirtualShotKind(virtualShot.sampled.shotKind)} · modelled result`
          : `Shot ${virtualShotNumber} · ${formatMobileAim(virtualAimDirectionDeg)}`
        : strategyClub
          ? `${formatProbability(strategyClub.probabilities.fairway)} fairway · ${strategyClub.averageRemainingYd.toFixed(0)} yd leave`
          : strategyState.status === "loading"
            ? "Building your personal strategy…"
            : "Personal strategy unavailable";

  return (
    <div
      data-mobile-preserve-dark
      data-course-twin-stage
      data-course-twin-render-quality={renderQuality}
      className={cn(
        mobileStyles.stage,
        "relative grid min-h-[calc(100dvh-5rem)] bg-[#07150e] text-white xl:h-full xl:min-h-0 xl:overflow-hidden",
      )}
    >
      {(() => {
        const controls = (
          <aside data-course-twin-hud className="w-full text-white">
            <div
              data-course-twin-primary-controls
              aria-label="Course Twin settings"
              className={cn(hudPanel === "course" ? "block" : "hidden", "w-full px-4 pb-6")}
            >
              <div className="relative space-y-1 xl:pr-9">
                <button
                  type="button"
                  className="absolute right-0 top-0 grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white lg:size-8"
                  aria-label="Close course controls"
                  onClick={closeHudPanel}
                >
                  <X className="size-4" />
                </button>
                <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
                  Grade {manifest.quality.grade} · {manifest.terrain.resolutionM?.toFixed(1)} m
                  terrain
                </Badge>
                <h1 className="pt-2 text-2xl font-semibold tracking-tight xl:text-lg">
                  {manifest.course.name}
                </h1>
                <p className="text-sm leading-6 text-emerald-100/70 xl:text-xs xl:leading-4">
                  Real mapped holes over Environment Agency LiDAR terrain and georeferenced aerial
                  reference imagery.{" "}
                  {manifest.quality.verified
                    ? "Putting contours are backed by reviewed high-resolution green surveys."
                    : "Green contours remain unverified for putting."}
                </p>
              </div>

              <div
                className={cn(
                  "mt-5 grid gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1 xl:mt-3",
                  readOnly ? "grid-cols-2" : "grid-cols-3",
                )}
              >
                <ModeButton
                  active={mode === "flyover"}
                  onClick={() => {
                    selectMode("flyover");
                    setCameraView("aerial");
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
                    setCameraView("aerial");
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
                            {roomState.room.visibility === "public"
                              ? "Public lobby"
                              : "Private invite"}{" "}
                            · You joined as {roomState.room.currentRole} ·{" "}
                            {roomState.room.sharedEventCount} verified{" "}
                            {roomState.room.sharedEventCount === 1 ? "event" : "events"}
                          </p>
                          {roomState.room.finalEventHash ? (
                            <p className="mt-1 font-mono text-[10px] text-emerald-200/70">
                              Locked {roomState.room.finalEventHash.slice(0, 12)}…
                            </p>
                          ) : roomState.room.latestSharedEvent ? (
                            <p className="mt-1 text-[11px] text-emerald-200/70">
                              Latest:{" "}
                              {roomState.room.latestSharedEvent.eventType.replaceAll(".", " ")}
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
                                roomJoinRole === role
                                  ? "bg-white/15 text-white"
                                  : "text-emerald-100/55",
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
                            onChange={(event) =>
                              setRoomInviteCode(event.target.value.toUpperCase())
                            }
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
                                  Hole {room.holeNumber} ·{" "}
                                  {room.competition ? "competition" : room.mode}
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
                    <p className="text-[11px] text-emerald-100/45">
                      Drag to orbit · scroll to zoom
                    </p>
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
                      label={
                        mode === "replay" ? "Reset camera to selected shot" : "Reset camera to tee"
                      }
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

              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 xl:mt-2 xl:p-3">
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
                <div className="mt-4 grid grid-cols-6 gap-1.5 xl:mt-3 xl:gap-1">
                  {manifest.holes.map((hole) => (
                    <button
                      key={hole.holeNumber}
                      type="button"
                      className={cn(
                        "min-h-10 rounded-lg border text-sm font-semibold transition-colors xl:min-h-8 xl:text-xs",
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
            </div>

            <div
              data-course-twin-shot-controls
              aria-label={mode === "replay" ? "Replay selection" : "Advanced controls"}
              className={cn(hudPanel === "analysis" ? "block" : "hidden", "w-full px-4 pb-6")}
            >
              <div className="mb-1 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/45">
                  {mode === "replay"
                    ? "Shot detail"
                    : mode === "strategy"
                      ? "Model detail"
                      : mode === "play"
                        ? "Round controls"
                        : mode === "live"
                          ? "Live controls"
                          : "Course detail"}
                </p>
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-white/65 transition hover:bg-white/10 hover:text-white lg:size-8"
                  aria-label="Close analysis controls"
                  onClick={closeHudPanel}
                >
                  <X className="size-4" />
                </button>
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
                    setCameraView("aerial");
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
                        onPlay={playVirtualPutt}
                        onContinue={continueVirtualPutt}
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
                        onPlay={playVirtualShot}
                        onContinue={continueVirtualShot}
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
                      onContinue={continueLiveShot}
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
                  Drag to orbit, scroll to zoom, and choose a hole to move the camera. Fairways,
                  greens and hazards come from saved semantic geometry; native screening vegetation
                  completes the visual course context where source tree geometry is incomplete.
                </div>
              )}

              <Collapsible className="group/attribution mt-4 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-emerald-100/50">
                <CollapsibleTrigger className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 text-left font-medium text-emerald-100/65">
                  Course data & licences
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]/attribution:rotate-180 motion-reduce:transition-none" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 leading-5">
                  {manifest.attribution.map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block underline"
                    >
                      {item.label} · {item.licence}
                    </a>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </aside>
        );
        const panelTitle =
          hudPanel === "course"
            ? "Course Twin settings"
            : mode === "replay"
              ? "Replay selection"
              : "Advanced controls";
        const panelDescription =
          hudPanel === "course"
            ? "Course, camera and secondary viewing controls."
            : "Choose a replay or adjust the current shot workflow.";
        return isCompactViewport ? (
          <Drawer open={Boolean(hudPanel)} onOpenChange={(open) => !open && closeHudPanel()}>
            <DrawerContent
              data-mobile-preserve-dark
              className="max-h-[86dvh] overflow-y-auto border-white/12 bg-[#07150e] text-white"
              style={{ colorScheme: "dark" }}
            >
              <DrawerHeader className="sr-only">
                <DrawerTitle>{panelTitle}</DrawerTitle>
                <DrawerDescription>{panelDescription}</DrawerDescription>
              </DrawerHeader>
              {controls}
            </DrawerContent>
          </Drawer>
        ) : (
          <Sheet open={Boolean(hudPanel)} onOpenChange={(open) => !open && closeHudPanel()}>
            <SheetContent
              data-mobile-preserve-dark
              side="right"
              showCloseButton={false}
              className="w-[390px] overflow-y-auto border-white/12 bg-[#07150e] p-0 text-white sm:max-w-[390px]"
              style={{ colorScheme: "dark" }}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>{panelTitle}</SheetTitle>
                <SheetDescription>{panelDescription}</SheetDescription>
              </SheetHeader>
              {controls}
            </SheetContent>
          </Sheet>
        );
      })()}

      <section
        data-course-twin-canvas
        inert={isCompactViewport && Boolean(hudPanel) ? true : undefined}
        aria-hidden={isCompactViewport && Boolean(hudPanel) ? true : undefined}
        className={cn(
          mobileStyles.canvas,
          "order-1 relative min-h-[62dvh] overflow-hidden xl:absolute xl:inset-0 xl:order-none xl:h-auto xl:min-h-0",
        )}
      >
        <Canvas
          shadows={renderQuality === "high" ? "percentage" : "basic"}
          dpr={renderQuality === "high" ? [1, 1.75] : [0.75, 1.25]}
          style={{
            cursor: mode === "play" && !virtualShot && !virtualPuttReplay ? "crosshair" : "default",
          }}
          camera={{ position: [0, 180, 240], fov: 48, near: 0.5, far: 6000 }}
          gl={{
            antialias: renderQuality === "high",
            powerPreference: renderQuality === "high" ? "high-performance" : "low-power",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.14,
          }}
          fallback={
            <div className="grid h-full min-h-0 place-items-center p-8 text-center lg:min-h-[560px]">
              WebGL is unavailable. Use the hole table below for the accessible course view.
            </div>
          }
        >
          <CourseTwinAdaptiveQuality renderQuality={renderQuality} />
          <color attach="background" args={[cameraView === "aerial" ? "#666b49" : "#75aecd"]} />
          <fog
            attach="fog"
            args={[cameraView === "aerial" ? "#737758" : "#b6ced0", 1_050, 3_300]}
          />
          <hemisphereLight args={["#d9efff", "#1d3b24", 0.58]} />
          <ambientLight color="#d9f0df" intensity={0.06} />
          <directionalLight
            castShadow
            color="#fff2d2"
            position={[-260, 285, 170]}
            intensity={1.7}
            shadow-mapSize-width={renderQuality === "high" ? 2048 : 1024}
            shadow-mapSize-height={renderQuality === "high" ? 2048 : 1024}
            shadow-bias={-0.00012}
          />
          <directionalLight color="#9fd5ff" position={[340, 170, -280]} intensity={0.12} />
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
                  completedTracers={
                    mode === "replay"
                      ? replayCompletedTracers
                      : mode === "play"
                        ? virtualCompletedTracers
                        : []
                  }
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
                    cameraView === "aerial" && (mode === "replay" || mode === "strategy")
                      ? selectedHole.tee
                      : (animatedShot?.start ??
                        (mode === "play"
                          ? virtualStart
                          : mode === "live"
                            ? liveStart
                            : selectedHole.tee))
                  }
                  cameraEnd={
                    cameraView === "aerial" && (mode === "replay" || mode === "strategy")
                      ? selectedHole.green
                      : (animatedShot?.totalEnd ??
                        (mode === "play" && !virtualShot && !virtualPuttReplay
                          ? virtualAimTarget
                          : selectedHole.green))
                  }
                  cameraUsesShotFraming={
                    Boolean(animatedShot) &&
                    !(cameraView === "aerial" && (mode === "replay" || mode === "strategy"))
                  }
                  strategyClub={mode === "strategy" ? strategyClub : null}
                  playback={playback}
                  cameraView={cameraView}
                  cameraCommand={cameraCommand}
                  exploreTransport={mode === "explore" ? exploreTransport : null}
                  renderQuality={renderQuality}
                />
              </Suspense>
            </>
          ) : null}
        </Canvas>
        <MobileCourseTwinChrome
          courseName={manifest.course.name}
          mode={mode}
          readOnly={readOnly}
          replayAvailable={Boolean(replay?.shots.length)}
          selectedHole={selectedHole}
          selectedHoleIndex={selectedHoleIndex}
          holeCount={manifest.holes.length}
          statusText={mobileHoleStatus}
          clubLabel={hudClub}
          carryLabel={hudCarryYd === null ? "—" : `${Math.round(hudCarryYd)} yd`}
          targetLabel={hudTarget}
          missLabel={hudMissPattern}
          roundLocksHole={roundLocksHole}
          coursePanelOpen={hudPanel === "course"}
          analysisPanelOpen={hudPanel === "analysis"}
          onOpenCourse={() => toggleHudPanel("course")}
          onOpenDetails={() => toggleHudPanel("analysis")}
          onPreviousHole={() => selectHole(manifest.holes[selectedHoleIndex - 1].holeNumber)}
          onNextHole={() => selectHole(manifest.holes[selectedHoleIndex + 1].holeNumber)}
          onSelectMode={activateRuntimeMode}
        >
          {mobileActionContent}
        </MobileCourseTwinChrome>
        <CourseTwinMinimalHud
          mode={mode}
          readOnly={readOnly}
          replayAvailable={Boolean(replay?.shots.length)}
          selectedHole={selectedHole}
          selectedHoleIndex={selectedHoleIndex}
          holeCount={manifest.holes.length}
          roundLocksHole={roundLocksHole}
          clubLabel={hudClub}
          carryLabel={hudCarryYd === null ? "—" : `${Math.round(hudCarryYd)} yd`}
          currentLabel={hudCurrent}
          onSelectMode={activateRuntimeMode}
          onOpenSettings={() => toggleHudPanel("course")}
          onOpenAdvanced={() => toggleHudPanel("analysis")}
          onPreviousHole={() => selectHole(manifest.holes[selectedHoleIndex - 1].holeNumber)}
          onNextHole={() => selectHole(manifest.holes[selectedHoleIndex + 1].holeNumber)}
        />
        <div className="hidden" aria-hidden="true">
          <div className="hidden lg:contents">
            <CinematicPerformanceHud
              mode={mode}
              replay={replay}
              selectedHole={selectedHole}
              shots={holeShots}
              selectedShot={selectedShot}
              shotIndex={shotIndex}
              playing={playing}
              playback={playback}
              simulation={
                mode === "replay"
                  ? selectedSimulation
                  : mode === "play"
                    ? (virtualPuttReplay?.simulation ?? virtualSimulation)
                    : mode === "live"
                      ? liveSimulation
                      : null
              }
              strategy={strategyClub}
              strategyStatus={strategyState.status}
              remainingYd={
                mode === "play"
                  ? virtualRemainingYd
                  : mode === "live"
                    ? liveSimulation
                      ? courseTwinDistanceToPinYd(
                          simulationDropPoint(liveSimulation),
                          selectedHole.green,
                        )
                      : courseTwinDistanceToPinYd(liveStart, selectedHole.green)
                    : null
              }
              strokes={mode === "play" ? virtualStrokes : mode === "live" ? liveStrokes : null}
              onSelectShot={(index) => {
                setShotIndex(index);
                setPlayback(0);
                setPlaying(false);
                setCameraView("aerial");
                setCameraCommand(null);
              }}
              onToggleReplay={() => {
                if (playback >= 1) setPlayback(0);
                setPlaying((current) => !current);
              }}
            />
          </div>
          <div
            data-course-twin-tablet-controls
            className="pointer-events-none absolute inset-x-3 top-3 z-10 hidden items-center justify-between gap-2 lg:flex xl:hidden"
          >
            <button
              type="button"
              className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl border border-white/15 bg-[#07150e]/80 px-2.5 py-2 text-left text-white shadow-xl backdrop-blur-2xl"
              aria-label="Open course controls"
              aria-expanded={hudPanel === "course"}
              onClick={() => setHudPanel((current) => (current === "course" ? null : "course"))}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#e7ff6a] text-xs font-black text-[#102217]">
                CT
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-100/45">
                  Course Twin
                </span>
                <span className="block max-w-[150px] truncate text-xs font-semibold">
                  {manifest.course.name}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={cn(
                "pointer-events-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-xl backdrop-blur-2xl",
                hudPanel === "analysis"
                  ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                  : "border-white/15 bg-[#07150e]/80 text-white",
              )}
              aria-label="Open analysis controls"
              aria-expanded={hudPanel === "analysis"}
              onClick={() => setHudPanel((current) => (current === "analysis" ? null : "analysis"))}
            >
              <BarChart3 className="size-4" /> Details
            </button>
          </div>

          <div
            data-course-twin-tablet-controls
            className="pointer-events-none absolute inset-x-3 bottom-20 z-10 hidden lg:block xl:hidden"
          >
            <div className="mb-2 flex items-end justify-between">
              <div className="rounded-2xl border border-white/15 bg-[#07150e]/80 px-3 py-2 text-white shadow-xl backdrop-blur-2xl">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#e7ff6a]/70">
                  Hole {selectedHole.holeNumber}
                </p>
                <p className="text-sm font-bold">
                  {selectedHole.yards} yd · Par {selectedHole.par}
                </p>
              </div>
              <div className="pointer-events-auto flex gap-1 rounded-full border border-white/15 bg-[#07150e]/80 p-1 shadow-xl backdrop-blur-2xl">
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-full text-white disabled:opacity-30"
                  disabled={roundLocksHole || selectedHoleIndex <= 0}
                  onClick={() => selectHole(manifest.holes[selectedHoleIndex - 1].holeNumber)}
                  aria-label="Previous hole"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-full text-white disabled:opacity-30"
                  disabled={roundLocksHole || selectedHoleIndex >= manifest.holes.length - 1}
                  onClick={() => selectHole(manifest.holes[selectedHoleIndex + 1].holeNumber)}
                  aria-label="Next hole"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
            <div
              data-course-twin-runtime-mode-dock
              className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/15 bg-[#07150e]/84 p-1.5 shadow-2xl backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <RuntimeDockButton
                active={mode === "flyover"}
                label="Flyover"
                onClick={() => activateRuntimeMode("flyover")}
              />
              <RuntimeDockButton
                active={mode === "replay"}
                label="Replay"
                disabled={!replay?.shots.length}
                onClick={() => activateRuntimeMode("replay")}
              />
              {!readOnly ? (
                <>
                  <RuntimeDockButton
                    active={mode === "strategy"}
                    label="Strategy"
                    onClick={() => activateRuntimeMode("strategy")}
                  />
                  <RuntimeDockButton
                    active={mode === "play"}
                    label="Play"
                    onClick={() => activateRuntimeMode("play")}
                  />
                  <RuntimeDockButton
                    active={mode === "live"}
                    label="Live"
                    onClick={() => activateRuntimeMode("live")}
                  />
                  <RuntimeDockButton
                    active={mode === "explore"}
                    label="Explore"
                    onClick={() => activateRuntimeMode("explore")}
                  />
                </>
              ) : null}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 z-10 hidden xl:block">
            <button
              type="button"
              className="pointer-events-auto absolute left-4 top-4 flex max-w-[280px] items-center gap-3 rounded-2xl border border-white/15 bg-[#07150e]/76 px-3.5 py-2.5 text-left text-white shadow-xl shadow-black/20 backdrop-blur-2xl transition hover:border-white/25 hover:bg-[#07150e]/88"
              aria-label="Open course controls"
              aria-expanded={hudPanel === "course"}
              onClick={() => setHudPanel((current) => (current === "course" ? null : "course"))}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e7ff6a] text-sm font-black text-[#102217]">
                CT
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/50">
                  Course Twin · Grade {manifest.quality.grade}
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold">
                  {manifest.course.name}
                </span>
              </span>
              <SlidersHorizontal className="ml-1 size-4 shrink-0 text-emerald-100/55" />
            </button>

            <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold shadow-xl shadow-black/20 backdrop-blur-2xl transition",
                  hudPanel === "analysis"
                    ? "border-[#e7ff6a]/50 bg-[#e7ff6a] text-[#102217]"
                    : "border-white/15 bg-[#07150e]/76 text-white hover:border-white/25 hover:bg-[#07150e]/88",
                )}
                aria-label="Open analysis controls"
                aria-expanded={hudPanel === "analysis"}
                onClick={() =>
                  setHudPanel((current) => (current === "analysis" ? null : "analysis"))
                }
              >
                <BarChart3 className="size-4" />
                Details
              </button>
              <div className="flex items-center rounded-full border border-white/15 bg-[#07150e]/76 p-1 shadow-xl shadow-black/20 backdrop-blur-2xl">
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    cameraView === "golfer" ? "bg-white/15 text-white" : "text-white/55",
                  )}
                  onClick={() => {
                    setCameraView("golfer");
                    setCameraCommand(null);
                  }}
                >
                  Shot
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    cameraView === "aerial" ? "bg-white/15 text-white" : "text-white/55",
                  )}
                  onClick={() => {
                    setCameraView("aerial");
                    setCameraCommand(null);
                  }}
                >
                  Aerial
                </button>
              </div>
            </div>

            <div
              data-course-twin-hole-hud
              className="pointer-events-auto absolute bottom-4 left-4 w-[180px] rounded-[1.35rem] border border-white/15 bg-[#07150e]/78 p-4 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl 2xl:w-[190px]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e7ff6a]/75">
                Now viewing
              </p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-black tracking-[-0.06em]">
                    {selectedHole.holeNumber}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white/85">
                    {selectedHole.yards} yd · Par {selectedHole.par}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-30"
                    disabled={roundLocksHole || selectedHoleIndex <= 0}
                    onClick={() => selectHole(manifest.holes[selectedHoleIndex - 1].holeNumber)}
                    aria-label="Previous hole"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-30"
                    disabled={roundLocksHole || selectedHoleIndex >= manifest.holes.length - 1}
                    onClick={() => selectHole(manifest.holes[selectedHoleIndex + 1].holeNumber)}
                    aria-label="Next hole"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 h-px bg-gradient-to-r from-[#e7ff6a]/70 to-transparent" />
            </div>

            <div
              data-course-twin-runtime-mode-dock
              className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/15 bg-[#07150e]/82 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-2xl"
            >
              <RuntimeDockButton
                active={mode === "flyover"}
                label="Flyover"
                onClick={() => activateRuntimeMode("flyover")}
              />
              <RuntimeDockButton
                active={mode === "replay"}
                label="Replay"
                disabled={!replay?.shots.length}
                onClick={() => activateRuntimeMode("replay")}
              />
              {!readOnly ? (
                <>
                  <RuntimeDockButton
                    active={mode === "strategy"}
                    label="Strategy"
                    onClick={() => activateRuntimeMode("strategy")}
                  />
                  <RuntimeDockButton
                    active={mode === "play"}
                    label="Play"
                    onClick={() => activateRuntimeMode("play")}
                  />
                  <RuntimeDockButton
                    active={mode === "live"}
                    label="Live"
                    onClick={() => activateRuntimeMode("live")}
                  />
                  <RuntimeDockButton
                    active={mode === "explore"}
                    label="Explore"
                    onClick={() => activateRuntimeMode("explore")}
                  />
                </>
              ) : null}
            </div>

            <div
              data-course-twin-camera-controls
              className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-1 rounded-full border border-white/15 bg-[#07150e]/76 p-1 shadow-xl shadow-black/20 backdrop-blur-2xl"
            >
              <CameraControlButton
                label="Orbit camera left"
                onClick={() => issueCameraCommand("orbit-left")}
              >
                <ChevronLeft className="size-4" />
              </CameraControlButton>
              <CameraControlButton label="Reset camera" onClick={() => issueCameraCommand("reset")}>
                <LocateFixed className="size-4" />
              </CameraControlButton>
              <CameraControlButton
                label="Orbit camera right"
                onClick={() => issueCameraCommand("orbit-right")}
              >
                <ChevronRight className="size-4" />
              </CameraControlButton>
            </div>
          </div>
        </div>
        <div data-course-twin-tablet-controls className="hidden">
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

function CourseTwinMinimalHud({
  mode,
  readOnly,
  replayAvailable,
  selectedHole,
  selectedHoleIndex,
  holeCount,
  roundLocksHole,
  clubLabel,
  carryLabel,
  currentLabel,
  onSelectMode,
  onOpenSettings,
  onOpenAdvanced,
  onPreviousHole,
  onNextHole,
}: {
  mode: RuntimeMode;
  readOnly: boolean;
  replayAvailable: boolean;
  selectedHole: CourseTwinHole;
  selectedHoleIndex: number;
  holeCount: number;
  roundLocksHole: boolean;
  clubLabel: string;
  carryLabel: string;
  currentLabel: string;
  onSelectMode: (mode: RuntimeMode) => void;
  onOpenSettings: () => void;
  onOpenAdvanced: () => void;
  onPreviousHole: () => void;
  onNextHole: () => void;
}) {
  const primaryMode = mode === "strategy" || mode === "replay" || mode === "play" ? mode : "";
  const modes: Array<"strategy" | "replay" | "play"> = ["strategy", "replay", "play"];

  return (
    <div
      data-course-twin-desktop-hud
      className="pointer-events-none absolute inset-0 z-10 hidden lg:block"
      aria-label="Course Twin heads-up display"
    >
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-4">
        <div
          data-course-twin-hole-hud
          className="pointer-events-auto flex h-11 items-center divide-x divide-white/12 rounded-full border border-white/14 bg-[#07150e]/68 px-1 text-white shadow-lg shadow-black/15 backdrop-blur-xl"
        >
          <HudFact label="Hole" value={String(selectedHole.holeNumber)} />
          <HudFact label="Par" value={String(selectedHole.par)} />
          <HudFact label="Distance" value={`${selectedHole.yards} yd`} />
        </div>

        <ToggleGroup
          data-course-twin-runtime-mode-dock
          type="single"
          value={primaryMode}
          onValueChange={(value) => value && onSelectMode(value as RuntimeMode)}
          spacing={1}
          className="pointer-events-auto rounded-full border border-white/14 bg-[#07150e]/72 p-1 shadow-lg shadow-black/15 backdrop-blur-xl"
          aria-label="Course Twin mode"
        >
          {modes.map((item) => (
            <ToggleGroupItem
              key={item}
              value={item}
              disabled={(item === "replay" && !replayAvailable) || (item === "play" && readOnly)}
              className="h-9 rounded-full border-0 px-4 text-xs font-semibold text-white/62 hover:bg-white/8 hover:text-white data-[state=on]:bg-[#e7ff6a] data-[state=on]:text-[#102217]"
            >
              {runtimeModeLabel(item)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div
          data-course-twin-hud-actions
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/14 bg-[#07150e]/68 p-1 shadow-lg shadow-black/15 backdrop-blur-xl"
        >
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white/72 transition hover:bg-white/10 hover:text-white"
            aria-label={mode === "replay" ? "Open replay selection" : "Open advanced controls"}
            onClick={onOpenAdvanced}
          >
            {mode === "replay" ? <CirclePlay className="size-4" /> : <Radar className="size-4" />}
            {mode === "replay" ? "Replays" : "Advanced"}
          </button>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-white"
            aria-label="Open Course Twin settings"
            onClick={onOpenSettings}
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      <div
        data-course-twin-current-plan
        className="pointer-events-auto absolute bottom-4 left-1/2 flex w-[min(720px,calc(100%-31rem))] min-w-[470px] -translate-x-1/2 items-center justify-between gap-5 rounded-full border border-white/14 bg-[#07150e]/68 px-4 py-2.5 text-white shadow-lg shadow-black/15 backdrop-blur-xl"
      >
        <div className="flex min-w-0 items-center gap-5">
          <HudFact label="Club" value={clubLabel} compact />
          <HudFact label="Expected carry" value={carryLabel} compact />
          <div className="min-w-0 border-l border-white/12 pl-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/38">
              {mode === "strategy" ? "Current strategy" : "Current shot"}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-white/88">{currentLabel}</p>
          </div>
        </div>
        <div
          className="hidden shrink-0 items-center gap-3 text-[9px] font-medium text-white/46 2xl:flex"
          aria-label="Visible course layers"
        >
          <VisualKey colour="#e7ff6a" label="Dispersion" />
          <VisualKey colour="#ffffff" label="Target" />
          <VisualKey colour="#66d9ff" label="Carry" />
          <VisualKey colour="#ffaf70" label="Hazards" />
        </div>
      </div>

      <div
        data-course-twin-hole-nav
        className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-1 rounded-full border border-white/14 bg-[#07150e]/68 p-1 shadow-lg shadow-black/15 backdrop-blur-xl"
      >
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          disabled={roundLocksHole || selectedHoleIndex <= 0}
          onClick={onPreviousHole}
          aria-label="Previous hole"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/48">
          Hole {selectedHole.holeNumber} / {holeCount}
        </span>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/9 px-3 text-xs font-semibold text-white transition hover:bg-white/14 disabled:opacity-30"
          disabled={roundLocksHole || selectedHoleIndex >= holeCount - 1}
          onClick={onNextHole}
        >
          Next hole <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function HudFact({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("px-3", compact && "px-0")}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-xs font-semibold text-white/90">{value}</p>
    </div>
  );
}

function VisualKey({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: colour }} />
      {label}
    </span>
  );
}

function MobileCourseTwinChrome({
  courseName,
  mode,
  readOnly,
  replayAvailable,
  selectedHole,
  selectedHoleIndex,
  holeCount,
  statusText,
  clubLabel,
  carryLabel,
  targetLabel,
  missLabel,
  roundLocksHole,
  coursePanelOpen,
  analysisPanelOpen,
  onOpenCourse,
  onOpenDetails,
  onPreviousHole,
  onNextHole,
  onSelectMode,
  children,
}: {
  courseName: string;
  mode: RuntimeMode;
  readOnly: boolean;
  replayAvailable: boolean;
  selectedHole: CourseTwinHole;
  selectedHoleIndex: number;
  holeCount: number;
  statusText: string;
  clubLabel: string;
  carryLabel: string;
  targetLabel: string;
  missLabel: string;
  roundLocksHole: boolean;
  coursePanelOpen: boolean;
  analysisPanelOpen: boolean;
  onOpenCourse: () => void;
  onOpenDetails: () => void;
  onPreviousHole: () => void;
  onNextHole: () => void;
  onSelectMode: (mode: RuntimeMode) => void;
  children: ReactNode;
}) {
  const modes: RuntimeMode[] = ["strategy", "replay", "play"];

  return (
    <div
      data-course-twin-mobile-chrome
      className={mobileStyles.mobileChrome}
      aria-label="Course Twin mobile controls"
      aria-hidden={coursePanelOpen || analysisPanelOpen ? true : undefined}
      inert={coursePanelOpen || analysisPanelOpen ? true : undefined}
    >
      <div className={mobileStyles.topBar}>
        <button
          type="button"
          className={mobileStyles.courseButton}
          aria-label="Open Course Twin settings"
          aria-expanded={coursePanelOpen}
          onClick={onOpenCourse}
        >
          <span className={mobileStyles.courseMark} aria-hidden="true">
            CT
          </span>
          <span className={mobileStyles.courseCopy}>
            <span className={mobileStyles.courseEyebrow}>Course Twin</span>
            <span className={mobileStyles.courseName}>{courseName}</span>
          </span>
        </button>
        <button
          type="button"
          className={mobileStyles.detailsButton}
          aria-label={mode === "replay" ? "Open replay selection" : "Open advanced controls"}
          aria-expanded={analysisPanelOpen}
          onClick={onOpenDetails}
        >
          <BarChart3 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div data-course-twin-action-tray className={mobileStyles.actionTray}>
        <div className={mobileStyles.holeBar}>
          <button
            type="button"
            className={mobileStyles.holeButton}
            disabled={roundLocksHole || selectedHoleIndex <= 0}
            onClick={onPreviousHole}
            aria-label="Previous hole"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <div className={mobileStyles.holeCopy}>
            <p className={mobileStyles.holeTitle}>
              Hole {selectedHole.holeNumber} · {selectedHole.yards} yd · Par {selectedHole.par}
            </p>
            <p className={mobileStyles.holeMeta}>
              {statusText.includes("Modelled") ? (
                <span data-course-twin-modelled-label>{statusText}</span>
              ) : (
                statusText
              )}
            </p>
          </div>
          <button
            type="button"
            className={mobileStyles.holeButton}
            disabled={roundLocksHole || selectedHoleIndex >= holeCount - 1}
            onClick={onNextHole}
            aria-label="Next hole"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className={mobileStyles.mobileActionSummary} aria-label="Current shot plan">
          <button type="button" className={mobileStyles.actionFact} onClick={onOpenDetails}>
            <span>Club</span>
            <strong>{clubLabel}</strong>
          </button>
          <div className={mobileStyles.actionFact}>
            <span>Carry</span>
            <strong>{carryLabel}</strong>
          </div>
          <button type="button" className={mobileStyles.actionFact} onClick={onOpenDetails}>
            <span>Target</span>
            <strong>{targetLabel}</strong>
          </button>
          <button type="button" className={mobileStyles.actionFact} onClick={onOpenDetails}>
            <span>Shape / miss</span>
            <strong>{missLabel}</strong>
          </button>
          <button
            type="button"
            className={cn(mobileStyles.actionFact, mobileStyles.nextHoleAction)}
            disabled={roundLocksHole || selectedHoleIndex >= holeCount - 1}
            onClick={onNextHole}
          >
            <span>Next</span>
            <strong>
              Hole{" "}
              {selectedHoleIndex >= holeCount - 1
                ? selectedHole.holeNumber
                : selectedHole.holeNumber + 1}
            </strong>
          </button>
        </div>
        {mode === "strategy" ? null : children}
      </div>

      <ToggleGroup
        data-course-twin-mode-dock
        className={mobileStyles.modeDock}
        type="single"
        value={mode === "strategy" || mode === "replay" || mode === "play" ? mode : ""}
        onValueChange={(value) => value && onSelectMode(value as RuntimeMode)}
        spacing={0.5}
        aria-label="Course Twin mode"
      >
        {modes.map((item) => {
          const unavailable =
            (item === "replay" && !replayAvailable) ||
            (readOnly && item !== "strategy" && item !== "replay");
          return (
            <ToggleGroupItem
              key={item}
              value={item}
              className={cn(
                mobileStyles.modeButton,
                mode === item && mobileStyles.modeButtonActive,
              )}
              disabled={unavailable}
            >
              {runtimeModeLabel(item)}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

function MobileSummaryTray({
  title,
  detail,
  evidence,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  evidence: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={mobileStyles.summaryTray}>
      <div className="min-w-0">
        <p className={mobileStyles.summaryPrimary}>{title}</p>
        <p className={mobileStyles.summarySecondary}>{detail}</p>
        <p className={mobileStyles.summaryEvidence}>{evidence}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className={mobileStyles.secondaryAction} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function MobileReplayControls({
  shot,
  playing,
  playback,
  onToggle,
  onOpenDetails,
}: {
  shot: CourseTwinReplayShot | null;
  playing: boolean;
  playback: number;
  onToggle: () => void;
  onOpenDetails: () => void;
}) {
  if (!shot) {
    return (
      <MobileSummaryTray
        title="No replay on this hole"
        detail="Choose another hole or inspect the session details."
        evidence="Replay is only shown when measured launch evidence is available."
        actionLabel="Details"
        onAction={onOpenDetails}
      />
    );
  }

  return (
    <div className={mobileStyles.playTray}>
      <div className={mobileStyles.playMeta}>
        <p className={mobileStyles.playMetaPrimary}>
          {shot.clubType} · {formatYards(shot.metrics.carryYd.value)} carry
        </p>
        <p className={mobileStyles.playMetaSecondary}>Measured launch</p>
      </div>
      <div className={mobileStyles.progressTrack} aria-hidden="true">
        <div className={mobileStyles.progressFill} style={{ width: `${playback * 100}%` }} />
      </div>
      <button type="button" className={mobileStyles.primaryAction} onClick={onToggle}>
        {playing ? "Pause replay" : playback >= 1 ? "Replay shot" : "Play replay"}
      </button>
      <p className={mobileStyles.provenance}>
        Measured launch · derived placement · reconstructed flight and roll
      </p>
    </div>
  );
}

function MobileStrategyControls({
  state,
  selectedClub,
  onSelectClub,
  onOpenDetails,
}: {
  state: StrategyLoadState;
  selectedClub: CourseTwinStrategyClub | null;
  onSelectClub: (clubId: string) => void;
  onOpenDetails: () => void;
}) {
  if (state.status !== "ready" || !state.document || !selectedClub) {
    return (
      <MobileSummaryTray
        title={state.status === "error" ? "Strategy unavailable" : "Building strategy"}
        detail={state.error ?? "Reading measured bag distributions for this hole."}
        evidence="Recommendations are modelled estimates, not measured outcomes."
        actionLabel="Details"
        onAction={onOpenDetails}
      />
    );
  }

  return (
    <div className={mobileStyles.playTray}>
      <div className={mobileStyles.playMeta}>
        <p className={mobileStyles.playMetaPrimary}>Modelled hole plan</p>
        <p className={mobileStyles.playMetaSecondary}>
          {selectedClub.carryMedianYd.toFixed(0)} yd carry
        </p>
      </div>
      <label className={mobileStyles.field}>
        <span className={mobileStyles.fieldLabel}>Club plan</span>
        <select
          className={mobileStyles.select}
          value={selectedClub.clubId}
          onChange={(event) => onSelectClub(event.target.value)}
        >
          {state.document.clubs.map((club) => (
            <option key={club.clubId} value={club.clubId}>
              {club.clubType} · {club.carryMedianYd.toFixed(0)} yd
            </option>
          ))}
        </select>
      </label>
      <p className={mobileStyles.provenance}>
        Modelled from measured shots · landing probabilities are not guarantees
      </p>
    </div>
  );
}

function MobileVirtualRoundControls({
  state,
  hole,
  selectedClub,
  availableClubs,
  shotKind,
  shotKindOptions,
  onShotKindChange,
  onSelectClub,
  aimDirectionDeg,
  onAimDirectionChange,
  shotNumber,
  strokes,
  remainingYd,
  shot,
  simulation,
  playback,
  sync,
  onPlay,
  onContinue,
  onOpenDetails,
}: {
  state: StrategyLoadState;
  hole: CourseTwinHole;
  selectedClub: CourseTwinStrategyClub | null;
  availableClubs: CourseTwinStrategyClub[];
  shotKind: CourseTwinVirtualShotKind;
  shotKindOptions: CourseTwinVirtualShotKind[];
  onShotKindChange: (kind: CourseTwinVirtualShotKind) => void;
  onSelectClub: (clubId: string) => void;
  aimDirectionDeg: number;
  onAimDirectionChange: (value: number) => void;
  shotNumber: number;
  strokes: number;
  remainingYd: number;
  shot: CourseTwinVirtualShot | null;
  simulation: CourseTwinReplaySimulation | null;
  playback: number;
  sync: RoundSyncState["status"];
  onPlay: () => void;
  onContinue: () => void;
  onOpenDetails: () => void;
}) {
  if (state.status !== "ready" || !state.document || !selectedClub) {
    return (
      <MobileSummaryTray
        title={state.status === "error" ? "My Bag unavailable" : "Loading My Bag"}
        detail={state.error ?? "Preparing measured club distributions."}
        evidence="Virtual shots are modelled from measured bag evidence."
        actionLabel="Details"
        onAction={onOpenDetails}
      />
    );
  }

  if (shot && simulation) {
    const resultRemainingYd =
      Math.hypot(
        hole.green[0] - simulation.finalPosition.x,
        hole.green[2] - simulation.finalPosition.z,
      ) / 0.9144;
    return (
      <div className={mobileStyles.compactResultTray}>
        <div className={mobileStyles.progressTrack} aria-hidden="true">
          <div className={mobileStyles.progressFill} style={{ width: `${playback * 100}%` }} />
        </div>
        <button
          type="button"
          className={mobileStyles.primaryAction}
          disabled={playback < 1 || sync !== "ready"}
          onClick={onContinue}
        >
          {sync === "saving"
            ? "Saving shot…"
            : simulation.penalty
              ? "Take penalty drop"
              : "Play next shot"}
        </button>
        <p className="sr-only">
          {playback < 1 ? "Shot in flight. " : `${resultRemainingYd.toFixed(0)} yards left. `}
          Modelled from recent measured shots · not a guaranteed result
        </p>
      </div>
    );
  }

  const aimLimit = courseTwinAimLimitDeg(shotKind);
  const effectiveAim = THREE.MathUtils.clamp(aimDirectionDeg, -aimLimit, aimLimit);
  return (
    <div className={mobileStyles.compactPlayTray}>
      {shotKindOptions.length > 1 ? (
        <label className={mobileStyles.compactShotType}>
          <span className="sr-only">Shot type</span>
          <select
            className={mobileStyles.select}
            aria-label="Shot type"
            value={shotKind}
            onChange={(event) => onShotKindChange(event.target.value as CourseTwinVirtualShotKind)}
          >
            {shotKindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {formatVirtualShotKind(kind)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className={mobileStyles.compactShotToolbar}>
        <label className={mobileStyles.compactClubSelect}>
          <span className="sr-only">Club</span>
          <select
            className={mobileStyles.select}
            aria-label="Club and modelled carry in yards"
            value={selectedClub.clubId}
            onChange={(event) => onSelectClub(event.target.value)}
          >
            {availableClubs.map((club) => (
              <option key={club.clubId} value={club.clubId}>
                {club.clubType === "driver" ? "Drv" : club.clubType} ·{" "}
                {club.carryMedianYd.toFixed(0)} yd
              </option>
            ))}
          </select>
        </label>
        <input
          className={mobileStyles.compactAimRange}
          type="range"
          min={-aimLimit}
          max={aimLimit}
          step={0.5}
          value={effectiveAim}
          aria-label="Shot start direction"
          aria-valuetext={formatMobileAim(effectiveAim)}
          onChange={(event) => onAimDirectionChange(Number(event.target.value))}
        />
        <button
          type="button"
          className={cn(mobileStyles.primaryAction, mobileStyles.compactPlayAction)}
          disabled={sync === "saving"}
          onClick={onPlay}
          aria-label={`Play ${selectedClub.clubType}`}
        >
          Play
        </button>
      </div>
      <p className="sr-only">
        Shot {shotNumber}. {strokes} {strokes === 1 ? "stroke" : "strokes"}.{" "}
        {remainingYd.toFixed(0)}
        yards to the pin. Modelled from recent measured shots; not a guaranteed result.
      </p>
    </div>
  );
}

function MobilePuttingControls({
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
}: {
  hole: CourseTwinHole;
  start: CourseTwinPoint;
  puttNumber: number;
  strokes: number;
  aimOffsetDeg: number;
  pacePercent: number;
  result: CourseTwinPuttResult | null;
  playback: number;
  sync: RoundSyncState["status"];
  verified: boolean;
  onAimChange: (value: number) => void;
  onPaceChange: (value: number) => void;
  onPlay: () => void;
  onContinue: () => void;
}) {
  const distanceFt = Math.hypot(hole.green[0] - start[0], hole.green[2] - start[2]) * 3.280_84;
  if (result) {
    return (
      <div className={cn(mobileStyles.playTray, mobileStyles.landscapeControls)}>
        <div className={mobileStyles.playMeta}>
          <p className={mobileStyles.playMetaPrimary}>
            {result.holed ? "Modelled putt holed" : "Modelled putt read"}
          </p>
          <p className={mobileStyles.playMetaSecondary}>
            {result.holed
              ? `${strokes} strokes`
              : `${(result.remainingDistanceM * 3.280_84).toFixed(1)} ft left`}
          </p>
        </div>
        <div className={mobileStyles.progressTrack} aria-hidden="true">
          <div className={mobileStyles.progressFill} style={{ width: `${playback * 100}%` }} />
        </div>
        {!result.holed ? (
          <button
            type="button"
            className={mobileStyles.primaryAction}
            disabled={playback < 1 || sync !== "ready"}
            onClick={onContinue}
          >
            Read next putt
          </button>
        ) : null}
        <p className={mobileStyles.provenance}>
          {verified
            ? "Modelled break uses the reviewed survey · outcome is not measured"
            : "Modelled from mapped terrain · approximate, not measured"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(mobileStyles.playTray, mobileStyles.landscapeControls)}>
      <div className={mobileStyles.playMeta}>
        <p className={mobileStyles.playMetaPrimary}>Putt {puttNumber}</p>
        <p className={mobileStyles.playMetaSecondary}>
          {distanceFt < 10 ? distanceFt.toFixed(1) : distanceFt.toFixed(0)} ft to cup
        </p>
      </div>
      <div className={mobileStyles.shotActionRow}>
        <div className={mobileStyles.selectors}>
          <label className={mobileStyles.compactSelect}>
            <span className="sr-only">Putt aim</span>
            <select
              className={mobileStyles.select}
              aria-label="Putt aim"
              value={aimOffsetDeg}
              onChange={(event) => onAimChange(Number(event.target.value))}
            >
              <option value={-6}>6° left</option>
              <option value={-3}>3° left</option>
              <option value={0}>At cup</option>
              <option value={3}>3° right</option>
              <option value={6}>6° right</option>
            </select>
          </label>
          <label className={mobileStyles.compactSelect}>
            <span className="sr-only">Putt pace</span>
            <select
              className={mobileStyles.select}
              aria-label="Putt pace"
              value={pacePercent}
              onChange={(event) => onPaceChange(Number(event.target.value))}
            >
              <option value={88}>Die pace</option>
              <option value={100}>Cup pace</option>
              <option value={112}>Firm pace</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className={mobileStyles.primaryAction}
          disabled={sync === "saving"}
          onClick={onPlay}
        >
          Play putt
        </button>
      </div>
      <p className={mobileStyles.provenance}>
        {verified
          ? "Modelled break uses the reviewed survey · outcome is not measured"
          : "Modelled from mapped terrain · approximate, not measured"}
      </p>
    </div>
  );
}

function MobileLiveControls({
  bridge,
  pairingCode,
  strategy,
  selectedClub,
  shot,
  simulation,
  playback,
  sync,
  roundActive,
  onPairingCodeChange,
  onDetect,
  onPair,
  onSelectClub,
  onContinue,
  onOpenDetails,
}: {
  bridge: BridgeLoadState;
  pairingCode: string;
  strategy: StrategyLoadState;
  selectedClub: CourseTwinStrategyClub | null;
  shot: CourseTwinReplayShot | null;
  simulation: CourseTwinReplaySimulation | null;
  playback: number;
  sync: RoundSyncState["status"];
  roundActive: boolean;
  onPairingCodeChange: (code: string) => void;
  onDetect: () => void;
  onPair: () => void;
  onSelectClub: (clubId: string) => void;
  onContinue: () => void;
  onOpenDetails: () => void;
}) {
  const connected = bridge.status === "connected";

  if (shot && simulation) {
    return (
      <div className={cn(mobileStyles.playTray, mobileStyles.landscapeControls)}>
        <div className={mobileStyles.playMeta}>
          <p className={mobileStyles.playMetaPrimary}>
            {shot.clubType} · {formatYards(shot.metrics.carryYd.value)} carry
          </p>
          <p className={mobileStyles.playMetaSecondary}>
            {playback < 1 ? "Measured shot in flight" : formatSurface(simulation.finalSurface)}
          </p>
        </div>
        <div className={mobileStyles.progressTrack} aria-hidden="true">
          <div className={mobileStyles.progressFill} style={{ width: `${playback * 100}%` }} />
        </div>
        <button
          type="button"
          className={mobileStyles.primaryAction}
          disabled={playback < 1 || sync !== "ready"}
          onClick={onContinue}
        >
          {sync === "saving"
            ? "Saving shot…"
            : simulation.penalty
              ? "Take penalty drop"
              : "Ready for next shot"}
        </button>
        <p className={mobileStyles.provenance}>
          Measured launch · reconstructed flight and mapped placement
        </p>
      </div>
    );
  }

  if (!connected) {
    const pairing = bridge.status === "available" || bridge.status === "pairing";
    return (
      <div className={mobileStyles.playTray}>
        <div className={mobileStyles.playMeta}>
          <p className={mobileStyles.playMetaPrimary}>Local live bridge</p>
          <p className={mobileStyles.playMetaSecondary}>
            {bridge.status === "detecting"
              ? "Finding bridge…"
              : pairing
                ? "Enter pairing code"
                : "Not connected"}
          </p>
        </div>
        {pairing ? (
          <div className={mobileStyles.shotActionRow}>
            <input
              className={cn(mobileStyles.select, mobileStyles.pairingInput)}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pairingCode}
              onChange={(event) =>
                onPairingCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              aria-label="Six-digit pairing code"
              placeholder="000000"
            />
            <button
              type="button"
              className={mobileStyles.primaryAction}
              disabled={bridge.status === "pairing" || pairingCode.length !== 6}
              onClick={onPair}
            >
              {bridge.status === "pairing" ? "Pairing…" : "Pair"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={mobileStyles.primaryAction}
            disabled={bridge.status === "detecting"}
            onClick={onDetect}
          >
            {bridge.status === "detecting" ? "Finding bridge…" : "Find local bridge"}
          </button>
        )}
        <p className={mobileStyles.provenance}>
          {bridge.error ?? "Pairing stays on this device; no monitor data leaves the computer"}
        </p>
      </div>
    );
  }

  if (!roundActive) {
    return (
      <MobileSummaryTray
        title="Live bridge connected"
        detail="Choose round rules before accepting a measured shot."
        evidence="Launch is measured; flight and course placement are reconstructed."
        actionLabel="Set up round"
        onAction={onOpenDetails}
      />
    );
  }

  return (
    <div className={mobileStyles.playTray}>
      <div className={mobileStyles.playMeta}>
        <p className={mobileStyles.playMetaPrimary}>
          {bridge.launchMonitorConnected ? "Ready for measured shot" : "Bridge paired"}
        </p>
        <p className={mobileStyles.playMetaSecondary}>
          {bridge.launchMonitorConnected ? "Monitor ready" : "Waiting for monitor"}
        </p>
      </div>
      {strategy.status === "ready" && strategy.document && selectedClub ? (
        <label className={mobileStyles.compactSelect}>
          <span className="sr-only">Live club</span>
          <select
            className={mobileStyles.select}
            aria-label="Live club"
            value={selectedClub.clubId}
            onChange={(event) => onSelectClub(event.target.value)}
          >
            {strategy.document.clubs.map((club) => (
              <option key={club.clubId} value={club.clubId}>
                {club.clubType}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <button type="button" className={mobileStyles.secondaryAction} onClick={onOpenDetails}>
          Open live details
        </button>
      )}
      <p className={mobileStyles.provenance}>
        Next launch is measured · flight and course placement are reconstructed
      </p>
    </div>
  );
}

function MobileExploreControls({
  transport,
  onTransportChange,
}: {
  transport: ExploreTransport;
  onTransportChange: (value: ExploreTransport) => void;
}) {
  return (
    <div className={mobileStyles.playTray}>
      <div className={mobileStyles.playMeta}>
        <p className={mobileStyles.playMetaPrimary}>Explore the mapped course</p>
        <p className={mobileStyles.playMetaSecondary}>
          {transport === "walk" ? "Walking" : "Cart"}
        </p>
      </div>
      <div className={mobileStyles.selectors} role="group" aria-label="Explore transport">
        {(["walk", "cart"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={cn(
              mobileStyles.secondaryAction,
              transport === item && mobileStyles.primaryAction,
            )}
            aria-pressed={transport === item}
            onClick={() => onTransportChange(item)}
          >
            {item === "walk" ? "Walk" : "Cart"}
          </button>
        ))}
      </div>
      <div className={mobileStyles.exploreControls} role="group" aria-label="Explore movement">
        {[
          ["Left", { turn: 1 }],
          ["Forward", { forward: 1 }],
          ["Back", { forward: -1 }],
          ["Right", { turn: -1 }],
        ].map(([label, movement]) => (
          <button
            key={String(label)}
            type="button"
            className={mobileStyles.secondaryAction}
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("course-twin-roam-step", {
                  detail: movement,
                }),
              );
            }}
          >
            {String(label)}
          </button>
        ))}
      </div>
      <p className={mobileStyles.provenance}>
        Tap to move and turn · movement follows the mapped terrain
      </p>
    </div>
  );
}

function runtimeModeLabel(mode: RuntimeMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function formatMobileAim(directionDeg: number) {
  if (Math.abs(directionDeg) < 0.25) return "Centre";
  return `${Math.abs(directionDeg).toFixed(directionDeg % 1 === 0 ? 0 : 1)}° ${directionDeg < 0 ? "left" : "right"}`;
}

function formatStrategyTarget(aimOffsetYd: number) {
  if (Math.abs(aimOffsetYd) < 0.5) return "Centre line";
  return `${Math.abs(aimOffsetYd).toFixed(0)} yd ${aimOffsetYd < 0 ? "left" : "right"}`;
}

function formatStrategyMissPattern(club: CourseTwinStrategyClub | null) {
  if (!club) return "—";
  const mean = club.shotModel.sideMeanYd;
  const spread = club.shotModel.sideStdDevYd;
  if (Math.abs(mean) < 1.5) return `±${spread.toFixed(0)} yd`;
  return `${Math.abs(mean).toFixed(0)} yd ${mean < 0 ? "L" : "R"} · ±${spread.toFixed(0)}`;
}

function CinematicPerformanceHud({
  mode,
  replay,
  selectedHole,
  shots,
  selectedShot,
  shotIndex,
  playing,
  playback,
  simulation,
  strategy,
  strategyStatus,
  remainingYd,
  strokes,
  onSelectShot,
  onToggleReplay,
}: {
  mode: RuntimeMode;
  replay: CourseTwinReplayDocument | null;
  selectedHole: CourseTwinHole;
  shots: CourseTwinReplayShot[];
  selectedShot: CourseTwinReplayShot | null;
  shotIndex: number;
  playing: boolean;
  playback: number;
  simulation: CourseTwinReplaySimulation | null;
  strategy: CourseTwinStrategyClub | null;
  strategyStatus: StrategyLoadState["status"];
  remainingYd: number | null;
  strokes: number | null;
  onSelectShot: (index: number) => void;
  onToggleReplay: () => void;
}) {
  if (mode === "replay" && selectedShot) {
    const carry = selectedShot.metrics.carryYd.value;
    const total = selectedShot.metrics.totalYd.value;
    const side = selectedShot.metrics.sideCarryYd.value;
    return (
      <div className="pointer-events-auto absolute left-1/2 top-[4.25rem] z-10 w-[calc(100%-1.5rem)] min-w-0 -translate-x-1/2 rounded-[1.35rem] border border-white/15 bg-[#07150e]/78 p-3 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl xl:top-4 xl:w-[min(560px,calc(100vw-860px))] xl:min-w-[400px] xl:p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/50">
              {replay?.session.title ?? "Shot replay"} · Hole {selectedHole.holeNumber}
            </p>
            <div className="mt-1 flex items-end gap-3">
              <p className="whitespace-nowrap text-[2.65rem] font-black leading-none tracking-[-0.06em]">
                {formatYards(carry)}
              </p>
              <p className="pb-1 text-sm font-semibold text-white/70">
                {selectedShot.clubType} · measured carry
              </p>
            </div>
          </div>
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/8 text-white transition hover:bg-white/15"
            onClick={onToggleReplay}
            aria-label={playing ? "Pause replay" : "Play replay"}
          >
            {playing ? <CirclePause className="size-5" /> : <CirclePlay className="size-5" />}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          <CinematicMetric label="Total" value={formatYards(total)} />
          <CinematicMetric label="Offline" value={formatOffline(side)} />
          <CinematicMetric
            label="Finished"
            value={simulation ? formatSurface(simulation.finalSurface) : "Reconstructed"}
            alert={Boolean(simulation?.penalty)}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#e7ff6a] transition-[width]"
              style={{ width: `${playback * 100}%` }}
            />
          </div>
          <div className="flex gap-1">
            {shots.map((shot, index) => (
              <button
                key={shot.id}
                type="button"
                className={cn(
                  "grid size-7 place-items-center rounded-full border text-[11px] font-bold transition",
                  index === shotIndex
                    ? "border-[#e7ff6a] bg-[#e7ff6a] text-[#102217]"
                    : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white",
                )}
                aria-label={`View shot ${shot.holeShotNumber ?? index + 1}`}
                onClick={() => onSelectShot(index)}
              >
                {shot.holeShotNumber ?? index + 1}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-amber-100/55">
          Measured launch data · derived placement · reconstructed flight and roll
        </p>
      </div>
    );
  }

  if (mode === "strategy") {
    const seriousHazard = strategy
      ? strategy.probabilities.water +
        strategy.probabilities.out_of_bounds +
        strategy.probabilities.trees
      : null;
    return (
      <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-10 w-[calc(100%-1.5rem)] min-w-0 -translate-x-1/2 rounded-[1.35rem] border border-white/15 bg-[#07150e]/78 p-3 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl xl:top-4 xl:w-[min(540px,calc(100vw-860px))] xl:min-w-[400px] xl:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/50">
              My Bag strategy · Hole {selectedHole.holeNumber}
            </p>
            <div className="mt-1 flex items-end gap-3">
              <p className="text-[2.65rem] font-black leading-none tracking-[-0.06em]">
                {strategy?.clubType ?? (strategyStatus === "loading" ? "Modelling…" : "No model")}
              </p>
              {strategy ? (
                <p className="pb-1 text-sm font-semibold text-[#e7ff6a]">
                  {Math.round(strategy.carryMedianYd)} yd stock carry
                </p>
              ) : null}
            </div>
          </div>
          {strategy ? (
            <span className="rounded-full border border-[#e7ff6a]/30 bg-[#e7ff6a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#efffa5]">
              Recommended line
            </span>
          ) : null}
        </div>
        {strategy ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
              <CinematicMetric
                label="Fairway"
                value={formatProbability(strategy.probabilities.fairway)}
              />
              <CinematicMetric
                label="Serious hazard"
                value={formatProbability(seriousHazard ?? 0)}
                alert={(seriousHazard ?? 0) >= 0.15}
              />
              <CinematicMetric
                label="Average leave"
                value={`${strategy.averageRemainingYd.toFixed(0)} yd`}
              />
            </div>
            <p className="mt-2 text-[10px] leading-4 text-amber-100/55">
              Modelled estimate from {strategy.sampleSize} measured shots · outcomes are not
              guarantees
            </p>
          </>
        ) : (
          <p className="mt-3 border-t border-white/10 pt-3 text-xs text-emerald-100/55">
            {strategyStatus === "loading"
              ? "Running your measured dispersion against the mapped hole…"
              : "Open Details to load a strategy from your measured bag."}
          </p>
        )}
      </div>
    );
  }

  if (mode === "play" || mode === "live") {
    return (
      <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-10 w-[calc(100%-1.5rem)] min-w-0 -translate-x-1/2 rounded-[1.35rem] border border-white/15 bg-[#07150e]/78 p-3 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl xl:top-4 xl:w-[min(500px,calc(100vw-860px))] xl:min-w-[400px] xl:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/50">
          {mode === "live" ? "Live launch-monitor round" : "My Bag test round"} · Hole{" "}
          {selectedHole.holeNumber}
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div className="flex items-end gap-2">
            <p className="text-[2.65rem] font-black leading-none tracking-[-0.06em]">
              {remainingYd === null ? "—" : Math.round(remainingYd)}
            </p>
            <p className="pb-1 text-sm font-semibold text-white/65">yd remaining</p>
          </div>
          <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75">
            {strokes ?? 0} {(strokes ?? 0) === 1 ? "stroke" : "strokes"}
          </p>
        </div>
        <div className="mt-3 h-px bg-gradient-to-r from-[#e7ff6a]/70 via-white/10 to-transparent" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute left-1/2 top-[4.25rem] z-10 w-[calc(100%-1.5rem)] min-w-0 -translate-x-1/2 rounded-[1.35rem] border border-white/15 bg-[#07150e]/72 p-3 text-center text-white shadow-2xl shadow-black/25 backdrop-blur-2xl xl:top-4 xl:w-[min(480px,calc(100vw-860px))] xl:min-w-[380px] xl:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/50">
        {mode === "explore" ? "Explore the mapped course" : "Course overview"}
      </p>
      <p className="mt-1 text-2xl font-black tracking-[-0.04em]">
        Hole {selectedHole.holeNumber} · {selectedHole.yards} yd
      </p>
      <p className="mt-1 text-xs text-emerald-100/55">
        Real mapped terrain · semantic fairways, greens and hazards
      </p>
    </div>
  );
}

function CinematicMetric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/40">
        {label}
      </p>
      <p
        className={cn("mt-0.5 truncate text-sm font-bold", alert ? "text-rose-300" : "text-white")}
      >
        {value}
      </p>
    </div>
  );
}

function RuntimeDockButton({
  active,
  label,
  disabled = false,
  onClick,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "rounded-xl px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35",
        active
          ? "bg-[#e7ff6a] text-[#102217] shadow-[0_0_24px_rgba(231,255,106,0.15)]"
          : "text-white/60 hover:bg-white/8 hover:text-white",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function formatOffline(value: number | null) {
  if (value === null) return "—";
  if (Math.abs(value) < 0.5) return "Centre";
  return `${Math.abs(value).toFixed(0)} yd ${value < 0 ? "left" : "right"}`;
}

function simulationDropPoint(simulation: CourseTwinReplaySimulation): CourseTwinPoint {
  const point = virtualDropPoint(simulation);
  return [point.x, point.y, point.z];
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
  renderQuality,
}: {
  manifest: CourseTwinManifest;
  terrainSamples: Float32Array;
  sampleTerrain: CourseTwinTerrainSampler;
  selectedHole: CourseTwinHole;
  selectedShot: CourseTwinReplayShot | null;
  selectedSimulation: CourseTwinReplaySimulation | null;
  completedTracers: Array<{
    id: string;
    shotNumber: number;
    simulation: CourseTwinReplaySimulation;
  }>;
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
  renderQuality: Exclude<CourseTwinRenderQuality, "fallback">;
}) {
  const holeLength = Math.max(
    1,
    Math.hypot(cameraEnd[0] - cameraStart[0], cameraEnd[2] - cameraStart[2]),
  );
  const focusDistance = cameraUsesShotFraming
    ? cameraView === "golfer"
      ? THREE.MathUtils.clamp(holeLength * 0.65, 24, 72)
      : THREE.MathUtils.clamp(holeLength * 0.5, 28, 140)
    : cameraView === "golfer"
      ? THREE.MathUtils.clamp(holeLength * 0.62, 28, 85)
      : Math.min(holeLength * 0.52, 150);
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
      {cameraView === "golfer" ? (
        <AtmosphericBackdrop
          terrainBounds={manifest.terrain.heightmap?.localBounds ?? manifest.bounds}
          sampleTerrain={sampleTerrain}
        />
      ) : null}
      {manifest.features.map((feature) => (
        <SemanticFeature key={feature.id} feature={feature} sampleTerrain={sampleTerrain} />
      ))}
      {cameraView === "golfer" ? (
        <InstancedVegetation
          features={manifest.features}
          holes={manifest.holes}
          terrainBounds={manifest.terrain.heightmap?.localBounds ?? manifest.bounds}
          sampleTerrain={sampleTerrain}
          renderQuality={renderQuality}
        />
      ) : null}
      {manifest.holes
        .filter((hole) => cameraView === "golfer" || hole === selectedHole)
        .map((hole) => (
          <HoleGeometry
            key={hole.holeNumber}
            hole={hole}
            selected={hole === selectedHole}
            dimmed={
              hole === selectedHole &&
              (Boolean(selectedShot) || completedTracers.length > 0 || Boolean(nextShotStart))
            }
            showNumber={hole === selectedHole && cameraView === "aerial"}
            sampleTerrain={sampleTerrain}
          />
        ))}
      {selectedShot && selectedSimulation ? (
        <ReplayTracer
          key={selectedShot.id}
          simulation={selectedSimulation}
          playback={playback}
          active
          label={cameraView === "aerial" ? (selectedShot.holeShotNumber ?? undefined) : undefined}
        />
      ) : null}
      {completedTracers.map((tracer) => (
        <ReplayTracer
          key={tracer.id}
          simulation={tracer.simulation}
          playback={1}
          active={false}
          label={cameraView === "aerial" ? tracer.shotNumber : undefined}
          colourOverride={completedTracerColour(tracer.shotNumber)}
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
      highDetailImageryUrl={courseTwinHighDetailRuntimeUrl(manifest.course.id, imagery)}
      samples={samples}
      features={manifest.features}
      onAimPoint={onAimPoint}
    />
  );
}

function LidarTerrain({
  asset,
  imageryUrl,
  highDetailImageryUrl,
  samples,
  features,
  onAimPoint,
}: {
  asset: NonNullable<CourseTwinManifest["terrain"]["heightmap"]>;
  imageryUrl: string;
  highDetailImageryUrl: string | null;
  samples: Float32Array;
  features: CourseTwinFeature[];
  onAimPoint: ((point: CourseTwinPoint) => void) | null;
}) {
  const [
    loadedAerialTexture,
    loadedRoughTexture,
    loadedFairwayTexture,
    loadedGreenTexture,
    loadedBunkerTexture,
    loadedSurfaceNormalAtlas,
    loadedSurfaceRoughnessAtlas,
  ] = useTexture([
    imageryUrl,
    highDetailSurfaceMaps.rough.colour,
    highDetailSurfaceMaps.fairway.colour,
    highDetailSurfaceMaps.green.colour,
    highDetailSurfaceMaps.bunker.colour,
    highDetailSurfaceNormalAtlas,
    highDetailSurfaceRoughnessAtlas,
  ]);
  const masks = useMemo(
    () => createCourseTwinTerrainMasks(features, asset.localBounds),
    [asset.localBounds, features],
  );
  const { gl } = useThree();
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const [
    texture,
    roughTexture,
    fairwayTexture,
    greenTexture,
    bunkerTexture,
    surfaceNormalAtlas,
    surfaceRoughnessAtlas,
  ] = useMemo(() => {
    const aerialTexture = loadedAerialTexture.clone();
    aerialTexture.colorSpace = THREE.SRGBColorSpace;
    aerialTexture.wrapS = THREE.ClampToEdgeWrapping;
    aerialTexture.wrapT = THREE.ClampToEdgeWrapping;
    aerialTexture.anisotropy = Math.min(12, maxAnisotropy);
    aerialTexture.needsUpdate = true;

    const surfaceTextures = [
      loadedRoughTexture.clone(),
      loadedFairwayTexture.clone(),
      loadedGreenTexture.clone(),
      loadedBunkerTexture.clone(),
    ];
    for (const surfaceTexture of surfaceTextures) {
      surfaceTexture.colorSpace = THREE.SRGBColorSpace;
      surfaceTexture.wrapS = THREE.RepeatWrapping;
      surfaceTexture.wrapT = THREE.RepeatWrapping;
      surfaceTexture.anisotropy = Math.min(12, maxAnisotropy);
      surfaceTexture.needsUpdate = true;
    }

    const dataTextures = [loadedSurfaceNormalAtlas.clone(), loadedSurfaceRoughnessAtlas.clone()];
    for (const dataTexture of dataTextures) {
      dataTexture.colorSpace = THREE.NoColorSpace;
      dataTexture.wrapS = THREE.RepeatWrapping;
      dataTexture.wrapT = THREE.RepeatWrapping;
      dataTexture.anisotropy = Math.min(12, maxAnisotropy);
      dataTexture.needsUpdate = true;
    }

    return [aerialTexture, ...surfaceTextures, ...dataTextures] as const;
  }, [
    loadedAerialTexture,
    loadedBunkerTexture,
    loadedFairwayTexture,
    loadedGreenTexture,
    loadedRoughTexture,
    loadedSurfaceNormalAtlas,
    loadedSurfaceRoughnessAtlas,
    maxAnisotropy,
  ]);
  const highDetailTexture = useProgressiveCourseImagery(highDetailImageryUrl, gl);
  const aerialTexture = highDetailTexture ?? texture;
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
      texture.dispose();
      roughTexture.dispose();
      fairwayTexture.dispose();
      greenTexture.dispose();
      bunkerTexture.dispose();
      surfaceNormalAtlas.dispose();
      surfaceRoughnessAtlas.dispose();
    },
    [
      bunkerTexture,
      fairwayTexture,
      greenTexture,
      roughTexture,
      surfaceNormalAtlas,
      surfaceRoughnessAtlas,
      texture,
    ],
  );
  useEffect(
    () => () => {
      masks.surface.dispose();
      masks.water.dispose();
    },
    [masks],
  );
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
        map={aerialTexture}
        normalMap={surfaceNormalAtlas}
        normalScale={new THREE.Vector2(0.36, 0.36)}
        color="#ffffff"
        roughness={0.92}
        metalness={0}
        onBeforeCompile={(shader) => {
          shader.uniforms.courseSurfaceMask = { value: masks.surface };
          shader.uniforms.courseWaterMask = { value: masks.water };
          shader.uniforms.roughColourMap = { value: roughTexture };
          shader.uniforms.fairwayColourMap = { value: fairwayTexture };
          shader.uniforms.greenColourMap = { value: greenTexture };
          shader.uniforms.bunkerColourMap = { value: bunkerTexture };
          shader.uniforms.courseSurfaceRoughnessAtlas = { value: surfaceRoughnessAtlas };
          shader.uniforms.courseTerrainSize = {
            value: new THREE.Vector2(terrainWidth, terrainDepth),
          };
          shader.uniforms.courseSurfaceTileSize = {
            value: new THREE.Vector4(
              highDetailSurfaceMaps.rough.visualMetresPerTile,
              highDetailSurfaceMaps.fairway.visualMetresPerTile,
              highDetailSurfaceMaps.green.visualMetresPerTile,
              highDetailSurfaceMaps.bunker.visualMetresPerTile,
            ),
          };
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_pars_fragment>",
            `#include <map_pars_fragment>
uniform sampler2D courseSurfaceMask;
uniform sampler2D courseWaterMask;
uniform sampler2D roughColourMap;
uniform sampler2D fairwayColourMap;
uniform sampler2D greenColourMap;
uniform sampler2D bunkerColourMap;
uniform sampler2D courseSurfaceRoughnessAtlas;
uniform vec2 courseTerrainSize;
uniform vec4 courseSurfaceTileSize;`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `#ifdef USE_MAP
  vec4 aerialColour = texture2D(map, vMapUv);
  vec3 surfaceWeights = texture2D(courseSurfaceMask, vMapUv).rgb;
  float waterWeight = texture2D(courseWaterMask, vMapUv).r;
  vec2 roughSurfaceCoordinate = vMapUv * courseTerrainSize / courseSurfaceTileSize.x;
  vec2 fairwaySurfaceCoordinate = vMapUv * courseTerrainSize / courseSurfaceTileSize.y;
  vec2 greenSurfaceCoordinate = vMapUv * courseTerrainSize / courseSurfaceTileSize.z;
  vec2 bunkerSurfaceCoordinate = vMapUv * courseTerrainSize / courseSurfaceTileSize.w;
  vec2 roughSurfaceUv = fract(roughSurfaceCoordinate);
  vec2 fairwaySurfaceUv = fract(fairwaySurfaceCoordinate);
  vec2 greenSurfaceUv = fract(greenSurfaceCoordinate);
  vec2 bunkerSurfaceUv = fract(bunkerSurfaceCoordinate);
  vec3 roughColour = texture2D(roughColourMap, roughSurfaceUv).rgb;
  vec3 fairwayColour = texture2D(fairwayColourMap, fairwaySurfaceUv).rgb;
  vec3 greenColour = texture2D(greenColourMap, greenSurfaceUv).rgb;
  vec3 bunkerColour = texture2D(bunkerColourMap, bunkerSurfaceUv).rgb;
  float roughWeight = clamp(
    1.0 - surfaceWeights.r - surfaceWeights.g - surfaceWeights.b,
    0.0,
    1.0
  );
  float surfaceDetailNearness = 1.0 - smoothstep(160.0, 780.0, length(vViewPosition));
  vec3 roughSurfaceColour = clamp((roughColour - vec3(0.33)) * 1.42 + vec3(0.33), 0.0, 1.0);
  vec3 fairwaySurfaceColour = clamp(
    (fairwayColour - vec3(0.47)) * 1.38 + vec3(0.47),
    0.0,
    1.0
  );
  vec3 greenSurfaceColour = clamp((greenColour - vec3(0.47)) * 1.14 + vec3(0.47), 0.0, 1.0);
  vec3 bunkerSurfaceColour = clamp((bunkerColour - vec3(0.63)) * 1.42 + vec3(0.63), 0.0, 1.0);
  float aerialLuma = dot(aerialColour.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 gradedAerial = mix(vec3(aerialLuma), aerialColour.rgb, 0.72) * vec3(1.14, 1.09, 0.98);
  gradedAerial = pow(clamp((gradedAerial - 0.5) * 1.02 + 0.518, 0.0, 1.0), vec3(0.9));
  vec3 courseColour = mix(
    gradedAerial,
    roughSurfaceColour * vec3(0.75, 0.89, 0.64),
    roughWeight * mix(0.28, 0.44, surfaceDetailNearness)
  );
  courseColour = mix(
    courseColour,
    fairwaySurfaceColour * vec3(0.74, 0.9, 0.68),
    surfaceWeights.r * mix(0.64, 0.78, surfaceDetailNearness)
  );
  courseColour = mix(
    courseColour,
    greenSurfaceColour * vec3(0.72, 0.94, 0.68),
    surfaceWeights.g * mix(0.58, 0.72, surfaceDetailNearness)
  );
  courseColour = mix(
    courseColour,
    bunkerSurfaceColour * vec3(1.04, 0.98, 0.88),
    surfaceWeights.b * mix(0.8, 0.9, surfaceDetailNearness)
  );
  mat2 courseSurfaceDetailRotation = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 roughFineCoordinate = courseSurfaceDetailRotation * roughSurfaceCoordinate * 1.35 + vec2(0.19, 0.43);
  vec2 fairwayFineCoordinate = courseSurfaceDetailRotation * fairwaySurfaceCoordinate * 1.85 + vec2(0.37, 0.11);
  vec2 greenFineCoordinate = courseSurfaceDetailRotation * greenSurfaceCoordinate * 1.35 + vec2(0.63, 0.29);
  vec2 bunkerFineCoordinate = courseSurfaceDetailRotation * bunkerSurfaceCoordinate * 1.55 + vec2(0.73, 0.31);
  vec3 roughFineColour = texture2D(roughColourMap, fract(roughFineCoordinate)).rgb;
  vec3 fairwayFineColour = texture2D(fairwayColourMap, fract(fairwayFineCoordinate)).rgb;
  vec3 greenFineColour = texture2D(greenColourMap, fract(greenFineCoordinate)).rgb;
  vec3 bunkerFineColour = texture2D(bunkerColourMap, fract(bunkerFineCoordinate)).rgb;
  float roughFineLuma = dot(roughFineColour, vec3(0.2126, 0.7152, 0.0722));
  float fairwayFineLuma = dot(fairwayFineColour, vec3(0.2126, 0.7152, 0.0722));
  float greenFineLuma = dot(greenFineColour, vec3(0.2126, 0.7152, 0.0722));
  float bunkerFineLuma = dot(bunkerFineColour, vec3(0.2126, 0.7152, 0.0722));
  float roughFineFootprint = max(fwidth(roughFineCoordinate.x), fwidth(roughFineCoordinate.y));
  float fairwayFineFootprint = max(fwidth(fairwayFineCoordinate.x), fwidth(fairwayFineCoordinate.y));
  float greenFineFootprint = max(fwidth(greenFineCoordinate.x), fwidth(greenFineCoordinate.y));
  float bunkerFineFootprint = max(fwidth(bunkerFineCoordinate.x), fwidth(bunkerFineCoordinate.y));
  float roughFineVisible = (1.0 - smoothstep(0.04, 0.115, roughFineFootprint)) * surfaceDetailNearness;
  float fairwayFineVisible = (1.0 - smoothstep(0.04, 0.115, fairwayFineFootprint)) * surfaceDetailNearness;
  float greenFineVisible = (1.0 - smoothstep(0.04, 0.115, greenFineFootprint)) * surfaceDetailNearness;
  float bunkerFineVisible = (1.0 - smoothstep(0.04, 0.115, bunkerFineFootprint)) * surfaceDetailNearness;
  float roughFineGrain = clamp(
    1.0 + (roughFineLuma - 0.33) * 0.72,
    0.82,
    1.18
  );
  float fairwayFineGrain = clamp(
    1.0 + (fairwayFineLuma - 0.47) * 0.64,
    0.84,
    1.16
  );
  float greenFineGrain = clamp(
    1.0 + (greenFineLuma - 0.47) * 0.3,
    0.92,
    1.08
  );
  float bunkerFineGrain = clamp(
    1.0 + (bunkerFineLuma - 0.63) * 0.72,
    0.82,
    1.18
  );
  courseColour = mix(
    courseColour,
    roughFineColour * vec3(0.75, 0.89, 0.64),
    roughWeight * roughFineVisible * 0.18
  );
  courseColour = mix(
    courseColour,
    fairwayFineColour * vec3(0.74, 0.9, 0.68),
    surfaceWeights.r * fairwayFineVisible * 0.16
  );
  courseColour = mix(
    courseColour,
    greenFineColour * vec3(0.72, 0.94, 0.68),
    surfaceWeights.g * greenFineVisible * 0.08
  );
  courseColour = mix(
    courseColour,
    bunkerFineColour * vec3(1.04, 0.98, 0.88),
    surfaceWeights.b * bunkerFineVisible * 0.2
  );
  courseColour *= mix(
    1.0,
    roughFineGrain,
    roughWeight * roughFineVisible * 0.82
  );
  courseColour *= mix(
    1.0,
    fairwayFineGrain,
    surfaceWeights.r * fairwayFineVisible * 0.72
  );
  courseColour *= mix(
    1.0,
    greenFineGrain,
    surfaceWeights.g * greenFineVisible * 0.35
  );
  courseColour *= mix(
    1.0,
    bunkerFineGrain,
    surfaceWeights.b * bunkerFineVisible * 0.82
  );
  vec3 reflectedWater = mix(courseColour * vec3(0.34, 0.58, 0.7), vec3(0.09, 0.4, 0.55), 0.58);
  courseColour = mix(courseColour, reflectedWater, waterWeight * 0.76);
  courseColour = pow(max(courseColour, vec3(0.0)), vec3(0.98));
  diffuseColor *= vec4(courseColour, aerialColour.a);
#endif`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_maps>",
            `#include <normal_fragment_maps>
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 courseNormalWeights = texture2D(courseSurfaceMask, vMapUv).rgb;
  float courseRoughWeight = clamp(
    1.0 - courseNormalWeights.r - courseNormalWeights.g - courseNormalWeights.b,
    0.0,
    1.0
  );
  vec2 courseRoughNormalUv = roughSurfaceUv * 0.496 + vec2(0.002, 0.502);
  vec2 courseFairwayNormalUv = fairwaySurfaceUv * 0.496 + vec2(0.502, 0.502);
  vec2 courseGreenNormalUv = greenSurfaceUv * 0.496 + vec2(0.002, 0.002);
  vec2 courseBunkerNormalUv = bunkerSurfaceUv * 0.496 + vec2(0.502, 0.002);
  vec3 courseRoughNormal = texture2D(normalMap, courseRoughNormalUv).xyz * 2.0 - 1.0;
  vec3 courseFairwayNormal = texture2D(normalMap, courseFairwayNormalUv).xyz * 2.0 - 1.0;
  vec3 courseGreenNormal = texture2D(normalMap, courseGreenNormalUv).xyz * 2.0 - 1.0;
  vec3 courseBunkerNormal = texture2D(normalMap, courseBunkerNormalUv).xyz * 2.0 - 1.0;
  courseRoughNormal.xy *= 0.76;
  courseFairwayNormal.xy *= 0.66;
  courseGreenNormal.xy *= 0.44;
  courseBunkerNormal.xy *= 0.78;
  vec3 courseBlendedNormal = normalize(
    courseRoughNormal * courseRoughWeight +
    courseFairwayNormal * courseNormalWeights.r +
    courseGreenNormal * courseNormalWeights.g +
    courseBunkerNormal * courseNormalWeights.b
  );
  normal = normalize(tbn * courseBlendedNormal);
#endif`,
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <roughnessmap_fragment>",
            `float roughnessFactor = roughness;
  vec3 courseRoughnessWeights = texture2D(courseSurfaceMask, vMapUv).rgb;
  float courseRoughnessRoughWeight = clamp(
    1.0 - courseRoughnessWeights.r - courseRoughnessWeights.g - courseRoughnessWeights.b,
    0.0,
    1.0
  );
  vec2 courseRoughRoughnessUv = roughSurfaceUv * 0.496 + vec2(0.002, 0.502);
  vec2 courseFairwayRoughnessUv = fairwaySurfaceUv * 0.496 + vec2(0.502, 0.502);
  vec2 courseGreenRoughnessUv = greenSurfaceUv * 0.496 + vec2(0.002, 0.002);
  vec2 courseBunkerRoughnessUv = bunkerSurfaceUv * 0.496 + vec2(0.502, 0.002);
  float courseSurfaceRoughness =
    texture2D(courseSurfaceRoughnessAtlas, courseRoughRoughnessUv).g * courseRoughnessRoughWeight +
    texture2D(courseSurfaceRoughnessAtlas, courseFairwayRoughnessUv).g * courseRoughnessWeights.r +
    texture2D(courseSurfaceRoughnessAtlas, courseGreenRoughnessUv).g * courseRoughnessWeights.g +
    texture2D(courseSurfaceRoughnessAtlas, courseBunkerRoughnessUv).g * courseRoughnessWeights.b;
  roughnessFactor *= courseSurfaceRoughness;`,
          );
        }}
        customProgramCacheKey={() => "course-twin-terrain-splat-v4-pbr-atlas"}
      />
    </mesh>
  );
}

function useProgressiveCourseImagery(url: string | null, gl: THREE.WebGLRenderer) {
  const [loaded, setLoaded] = useState<{ texture: THREE.Texture; url: string } | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    let loadedTexture: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        loadedTexture = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = gl.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        if (active) setLoaded({ texture, url });
        else texture.dispose();
      },
      undefined,
      () => undefined,
    );

    return () => {
      active = false;
      loadedTexture?.dispose();
    };
  }, [gl, url]);

  return loaded?.url === url ? loaded.texture : null;
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
  holes,
  terrainBounds,
  sampleTerrain,
  renderQuality,
}: {
  features: CourseTwinFeature[];
  holes: CourseTwinHole[];
  terrainBounds: CourseTwinManifest["bounds"];
  sampleTerrain: CourseTwinTerrainSampler;
  renderQuality: Exclude<CourseTwinRenderQuality, "fallback">;
}) {
  const trees = useMemo(
    () =>
      buildTreeInstances(features, holes, terrainBounds, sampleTerrain).slice(
        0,
        renderQuality === "high" ? 650 : 280,
      ),
    [features, holes, renderQuality, sampleTerrain, terrainBounds],
  );
  const bushes = useMemo(
    () =>
      buildBushInstances(features, holes, terrainBounds, sampleTerrain).slice(
        0,
        renderQuality === "high" ? 1_200 : 480,
      ),
    [features, holes, renderQuality, sampleTerrain, terrainBounds],
  );
  const textures = useTexture([
    ...treeBillboards.map(({ url }) => url),
    ...bushBillboards.map(({ url }) => url),
  ]);

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.offset.set(0, 0);
      texture.repeat.set(1, 1);
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
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, instances.length]}
      castShadow={planeRotation === 0}
    >
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        map={texture}
        alphaTest={0.34}
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
  holes: CourseTwinHole[],
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
  return [
    ...buildCourseTwinScreenTrees(features, holes, terrainBounds, sampleTerrain),
    ...instances,
  ].slice(0, 650);
}

function buildBushInstances(
  features: CourseTwinFeature[],
  holes: CourseTwinHole[],
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
  const screeningBushes = buildCourseTwinScreenTrees(features, holes, terrainBounds, sampleTerrain)
    .filter((_, index) => index % 2 === 0)
    .map((tree, index) => {
      const random = seededRandom(hashString(`screening-bush:${tree.x}:${tree.z}`));
      const distance = 2.6 + random() * 3.8;
      const angle = random() * Math.PI * 2;
      const x = tree.x + Math.cos(angle) * distance;
      const z = tree.z + Math.sin(angle) * distance;
      return {
        x,
        y: sampleTerrain(x, z),
        z,
        height: 1.2 + random() * 1.9,
        widthScale: 0.86 + random() * 0.36,
        tint: random() * 2 - 1,
        variant: index % bushBillboards.length,
        rotation: random() * Math.PI * 2,
      };
    });
  return [...instances, ...screeningBushes].slice(0, 1_200);
}

function buildCourseTwinScreenTrees(
  features: CourseTwinFeature[],
  holes: CourseTwinHole[],
  terrainBounds: CourseTwinManifest["bounds"],
  sampleTerrain: CourseTwinTerrainSampler,
) {
  const exclusions = features.filter((feature) =>
    ["tee", "fairway", "green", "bunker", "water"].includes(feature.type),
  );
  const instances: VegetationInstance[] = [];

  for (const hole of holes) {
    const start = hole.centerline[0] ?? hole.tee;
    const end = hole.centerline.at(-1) ?? hole.green;
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const length = Math.hypot(dx, dz);
    if (length < 1) continue;

    const directionX = dx / length;
    const directionZ = dz / length;
    const sideX = -directionZ;
    const sideZ = directionX;
    const pairs = THREE.MathUtils.clamp(Math.round(length / 78), 3, 8);
    const random = seededRandom(hashString(`screening:${hole.holeNumber}:${start[0]}:${start[2]}`));

    for (let index = 0; index < pairs; index += 1) {
      const progress = (index + 0.5 + (random() - 0.5) * 0.35) / pairs;
      const along = length * progress;
      for (const side of [-1, 1] as const) {
        const setback = 28 + random() * 38;
        const x = start[0] + directionX * along + sideX * setback * side;
        const z = start[2] + directionZ * along + sideZ * setback * side;
        if (
          x < terrainBounds.minX + 8 ||
          x > terrainBounds.maxX - 8 ||
          z < terrainBounds.minZ + 8 ||
          z > terrainBounds.maxZ - 8 ||
          exclusions.some((feature) => courseTwinFeatureContains(feature, x, z))
        ) {
          continue;
        }
        instances.push({
          x,
          y: sampleTerrain(x, z),
          z,
          height: 8.5 + random() * 8,
          widthScale: 0.78 + random() * 0.5,
          tint: random() * 2 - 1,
          variant: Math.floor(random() * treeBillboards.length),
          rotation: random() * Math.PI * 2,
        });
      }
    }
  }

  return instances.slice(0, 260);
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
  showNumber,
  sampleTerrain,
}: {
  hole: CourseTwinHole;
  selected: boolean;
  dimmed: boolean;
  showNumber: boolean;
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
      {showNumber ? <HoleNumberMarker position={tee} number={hole.holeNumber} /> : null}
      {selected ? <HoleFlag position={green} /> : null}
    </group>
  );
}

function HoleNumberMarker({
  position,
  number,
}: {
  position: [number, number, number];
  number: number;
}) {
  const texture = useMemo(() => holeNumberTexture(number), [number]);
  return (
    <sprite position={[position[0], position[1] + 5.5, position[2]]} scale={[7.2, 8.2, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}

function holeNumberTexture(number: number) {
  const key = `hole-number:${number}`;
  const cached = proceduralTextureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 224;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Hole number textures are unavailable.");
  const gradient = context.createLinearGradient(0, 30, 0, 206);
  gradient.addColorStop(0, "#fff4a8");
  gradient.addColorStop(0.48, "#e8bd54");
  gradient.addColorStop(1, "#8f5f16");
  context.shadowColor = "rgba(20, 12, 2, 0.78)";
  context.shadowBlur = 16;
  context.shadowOffsetY = 10;
  context.fillStyle = gradient;
  context.strokeStyle = "rgba(255, 245, 188, 0.82)";
  context.lineWidth = 4;
  context.font = "900 176px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.strokeText(String(number), 96, 117);
  context.fillText(String(number), 96, 117);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  proceduralTextureCache.set(key, texture);
  return texture;
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
  label,
  colourOverride,
  showCarryMarker = true,
  showFinishMarker = true,
}: {
  simulation: CourseTwinReplaySimulation;
  playback: number;
  active: boolean;
  label?: number;
  colourOverride?: string;
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
  const tracerColour = simulation.penalty
    ? "#fb7185"
    : (colourOverride ?? (active ? "#efff63" : "#63c9ff"));
  const groundColour = simulation.penalty ? "#ff9aac" : active ? "#ffffff" : "#9ee3ff";
  const flightPoints = flight.length >= 2 ? flight : [carry, carry];
  return (
    <group>
      <Line
        points={flightPoints}
        color={tracerColour}
        lineWidth={active ? 10 : 7}
        transparent
        opacity={active ? 0.16 : 0.12}
        depthTest={false}
        renderOrder={24}
      />
      <Line
        points={flightPoints}
        color={tracerColour}
        lineWidth={active ? 4.8 : 3.8}
        transparent
        opacity={active ? 0.98 : 0.9}
        depthTest={false}
        renderOrder={25}
      />
      <Line
        points={flightPoints}
        color="#ffffff"
        lineWidth={active ? 1.35 : 0.9}
        transparent
        opacity={active ? 0.72 : 0.42}
        depthTest={false}
        renderOrder={26}
      />
      {ground.length >= 2 ? (
        <>
          <Line
            points={ground}
            color={groundColour}
            lineWidth={active ? 7 : 5}
            transparent
            opacity={0.12}
            depthTest={false}
            renderOrder={24}
          />
          <Line
            points={ground}
            color={groundColour}
            lineWidth={active ? 3.4 : 2.8}
            transparent
            opacity={active ? 0.92 : 0.78}
            depthTest={false}
            renderOrder={25}
          />
        </>
      ) : null}
      {showCarryMarker ? (
        <group position={carry}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={27}>
            <ringGeometry args={[0.7, 0.96, 40]} />
            <meshBasicMaterial
              color={tracerColour}
              transparent
              opacity={0.92}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={26}>
            <circleGeometry args={[1.45, 40]} />
            <meshBasicMaterial
              color={tracerColour}
              transparent
              opacity={0.11}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        </group>
      ) : null}
      {showFinishMarker ? (
        <group position={finish}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={27}>
            <ringGeometry args={[0.9, 1.22, 44]} />
            <meshBasicMaterial
              color={tracerColour}
              transparent
              opacity={0.98}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={26}>
            <circleGeometry args={[1.9, 44]} />
            <meshBasicMaterial
              color={tracerColour}
              transparent
              opacity={0.13}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
          {label ? <TracerNumberMarker label={label} colour={tracerColour} /> : null}
        </group>
      ) : null}
      {active ? (
        <group position={marker}>
          <pointLight color={tracerColour} intensity={1.8} distance={12} decay={2} />
          <mesh castShadow renderOrder={28}>
            <sphereGeometry args={[0.34, 24, 24]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={tracerColour}
              emissiveIntensity={2.2}
              roughness={0.24}
            />
          </mesh>
          <sprite scale={[2.8, 2.8, 1]} renderOrder={27}>
            <spriteMaterial
              map={tracerGlowTexture()}
              color={tracerColour}
              transparent
              opacity={0.55}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </sprite>
        </group>
      ) : showFinishMarker ? (
        <mesh position={finish}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive={tracerColour} emissiveIntensity={1.35} />
        </mesh>
      ) : null}
    </group>
  );
}

function completedTracerColour(shotNumber: number) {
  const palette = ["#6ed7ff", "#ffcb4f", "#ff8f5a", "#ff78b4", "#83e7b0"];
  return palette[(Math.max(1, shotNumber) - 1) % palette.length];
}

function TracerNumberMarker({ label, colour }: { label: number; colour: string }) {
  const texture = useMemo(() => tracerNumberTexture(label, colour), [colour, label]);
  return (
    <sprite position={[0, 3.2, 0]} scale={[4.2, 4.2, 1]} renderOrder={30}>
      <spriteMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}

function tracerNumberTexture(label: number, colour: string) {
  const key = `tracer-number:${label}:${colour}`;
  const cached = proceduralTextureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Shot marker textures are unavailable.");
  context.shadowColor = colour;
  context.shadowBlur = 18;
  context.fillStyle = "rgba(8, 22, 14, 0.94)";
  context.beginPath();
  context.arc(64, 64, 43, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = colour;
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "800 54px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(label), 64, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  proceduralTextureCache.set(key, texture);
  return texture;
}

function tracerGlowTexture() {
  const cached = proceduralTextureCache.get("tracer-glow");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tracer glow textures are unavailable.");
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  proceduralTextureCache.set("tracer-glow", texture);
  return texture;
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
  const areaTexture = useMemo(() => strategyAreaTexture(), []);
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
  const spread = useMemo(() => {
    if (club.landingCloud.length === 0) return { width: 6, depth: 6 };
    const xs = club.landingCloud.map((point) => point[0]);
    const zs = club.landingCloud.map((point) => point[2]);
    return {
      width: THREE.MathUtils.clamp((Math.max(...xs) - Math.min(...xs)) * 0.58, 5, 28),
      depth: THREE.MathUtils.clamp((Math.max(...zs) - Math.min(...zs)) * 0.58, 5, 28),
    };
  }, [club.landingCloud]);

  return (
    <group>
      <Line
        points={[tee, cloudCenter]}
        color="#e7ff6a"
        lineWidth={8}
        transparent
        opacity={0.12}
        depthTest={false}
        renderOrder={21}
      />
      <Line
        points={[tee, cloudCenter]}
        color="#efff63"
        lineWidth={3.4}
        dashed
        dashSize={5}
        gapSize={3}
        transparent
        opacity={0.92}
        depthTest={false}
        renderOrder={22}
      />
      <mesh
        position={[cloudCenter[0], cloudCenter[1] - 0.34, cloudCenter[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[spread.width, spread.depth, 1]}
        renderOrder={18}
      >
        <circleGeometry args={[1, 64]} />
        <meshBasicMaterial
          map={areaTexture}
          color="#dfff4d"
          transparent
          opacity={0.34}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
        />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#f0ff73"
          map={pointTexture}
          alphaTest={0.08}
          size={2.5}
          sizeAttenuation
          transparent
          opacity={0.88}
          depthWrite={false}
          depthTest={false}
        />
      </points>
      <mesh position={cloudCenter} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 3.2, 44]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.96}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <mesh
        position={[cloudCenter[0], cloudCenter[1] - 0.25, cloudCenter[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={20}
      >
        <ringGeometry args={[4.7, 5.15, 72]} />
        <meshBasicMaterial
          color="#66d9ff"
          transparent
          opacity={0.76}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}

function strategyAreaTexture() {
  const cached = proceduralTextureCache.get("strategy-area");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Strategy area textures are unavailable.");
  const gradient = context.createRadialGradient(128, 128, 12, 128, 128, 126);
  gradient.addColorStop(0, "rgba(245,255,196,0.72)");
  gradient.addColorStop(0.48, "rgba(226,255,96,0.42)");
  gradient.addColorStop(0.82, "rgba(183,235,45,0.16)");
  gradient.addColorStop(1, "rgba(150,211,25,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  proceduralTextureCache.set("strategy-area", texture);
  return texture;
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
    (rawDelta: number, directInput?: { forward?: number; lateral?: number; turn?: number }) => {
      const delta = Math.min(directInput ? 0.16 : 0.05, rawDelta);
      const pressed = keys.current;
      const forwardInput =
        (pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0) -
        (pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0) +
        (directInput?.forward ?? 0);
      const lateralInput =
        (pressed.has("KeyD") || pressed.has("ArrowRight") ? 1 : 0) -
        (pressed.has("KeyA") || pressed.has("ArrowLeft") ? 1 : 0) +
        (directInput?.lateral ?? 0);
      const directTurnInput = directInput?.turn ?? 0;
      const isCart = transport === "cart";
      if (directTurnInput !== 0) {
        yaw.current += directTurnInput * delta * 1.65;
      } else if (isCart && lateralInput !== 0) {
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
    const onRoamStep = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          forward?: number;
          lateral?: number;
          turn?: number;
        }>
      ).detail;
      if (!detail || typeof detail !== "object") return;
      advanceMovement(0.16, {
        forward: THREE.MathUtils.clamp(Number(detail.forward) || 0, -1, 1),
        lateral: THREE.MathUtils.clamp(Number(detail.lateral) || 0, -1, 1),
        turn: THREE.MathUtils.clamp(Number(detail.turn) || 0, -1, 1),
      });
    };
    window.addEventListener("course-twin-advance-time", onAdvanceTime);
    window.addEventListener("course-twin-roam-step", onRoamStep);
    return () => {
      window.removeEventListener("course-twin-advance-time", onAdvanceTime);
      window.removeEventListener("course-twin-roam-step", onRoamStep);
    };
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
        : THREE.MathUtils.clamp(length * 0.5, 28, 140)
      : view === "golfer"
        ? THREE.MathUtils.clamp(length * 0.62, 28, 85)
        : Math.min(length * 0.52, 150);
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
        terrainStart[0] - directionX * Math.min(38, length * 0.14) - directionZ * 34,
        terrainStart[1] + Math.min(170, Math.max(76, length * 0.42)),
        terrainStart[2] - directionZ * Math.min(38, length * 0.14) + directionX * 34,
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
                ? "Each shot samples this club's latest 30 days of full-shot evidence, including measured spin axis."
                : "Recent shots for this club do not contain spin axis, so only a subtle curve is inferred from its latest 30-day left/right pattern."}{" "}
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
