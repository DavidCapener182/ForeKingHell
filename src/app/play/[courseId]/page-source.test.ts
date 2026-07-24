import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve(process.cwd(), "src/app/(app)/play/[courseId]/page.tsx"),
  "utf8",
);
const runtimeSource = readFileSync(
  resolve(process.cwd(), "src/app/play/[courseId]/course-twin-runtime.tsx"),
  "utf8",
);
const sceneSource = readFileSync(
  resolve(process.cwd(), "src/app/play/[courseId]/course-twin-scene.tsx"),
  "utf8",
);
const vegetationLedgerSource = readFileSync(
  resolve(process.cwd(), "public/course-twins/common/vegetation/assets.json"),
  "utf8",
);
const dataSource = readFileSync(resolve(process.cwd(), "src/lib/course-twin-data.ts"), "utf8");

describe("Course Twin route boundaries", () => {
  it("authenticates and loads evidence on the server before crossing the client boundary", () => {
    expect(pageSource).toContain("requireCurrentUserId()");
    expect(pageSource).toContain("getCourseTwinManifest({ userId, courseId })");
    expect(pageSource).toContain("getCourseTwinReplay({");
    expect(pageSource).toContain("<CourseTwinRuntime");
    expect(pageSource).toContain("manifest={manifest}");
    expect(pageSource).toContain("replay={replay}");
    expect(pageSource).toContain("tournamentId={query.tournamentId}");
  });

  it("keeps Three.js in a client-only dynamically loaded route bundle", () => {
    expect(runtimeSource).toContain('"use client"');
    expect(runtimeSource).toContain("ssr: false");
    expect(runtimeSource).toContain('import("./course-twin-scene")');
    expect(sceneSource).toContain('from "three"');
    expect(pageSource).not.toContain('from "three"');
  });

  it("keeps quality and replay provenance visible to golfers", () => {
    expect(sceneSource).toContain("Grade {manifest.quality.grade} ·");
    expect(sceneSource).toContain("Measured metrics · derived course placement");
    expect(sceneSource).toContain("manifest.attribution.map");
    expect(dataSource).toContain("bootleTerrainPackage.mapSource.label");
  });

  it("runs selected-shot playback through terrain and surface-aware physics", () => {
    expect(sceneSource).toContain("simulateCourseTwinReplayShot(selectedShot");
    expect(sceneSource).toContain("createCourseTwinSurfaceClassifier");
    expect(sceneSource).toContain("landingSurface: selectedSimulation.landingSurface");
    expect(sceneSource).toContain("finalSurface: selectedSimulation.finalSurface");
    expect(sceneSource).toContain("penalty: selectedSimulation.penalty");
    expect(sceneSource).toContain('label="Landed"');
  });

  it("loads player-specific strategy on demand and renders one selected landing cloud", () => {
    expect(sceneSource).toContain('active={mode === "strategy"}');
    expect(sceneSource).toContain("/strategy?holeNumber=${nextHoleNumber}");
    expect(sceneSource).toContain("<StrategyLandingCloud");
    expect(sceneSource).toContain('strategyClub={mode === "strategy" ? strategyClub : null}');
    expect(sceneSource).toContain("My Bag strategy");
    expect(sceneSource).toContain("selectedClub.probabilities.water");
  });

  it("supports deterministic My Bag virtual shots without claiming perfect outcomes", () => {
    expect(sceneSource).toContain('active={mode === "play"}');
    expect(sceneSource).toContain("buildCourseTwinVirtualShot({");
    expect(sceneSource).toContain("virtualDropPoint(virtualSimulation)");
    expect(sceneSource).toContain("Virtual round · My Bag");
    expect(sceneSource).toContain(
      "Your imported shots do not contain spin axis, so curve is inferred from measured left/right dispersion.",
    );
    expect(sceneSource).toContain("formatVirtualShape(shot.sampled.spinAxisDeg)");
    expect(sceneSource).toContain('"Dispersion inferred"');
    expect(sceneSource).toContain("buildCourseTwinAutomaticGreenCompletion");
    expect(sceneSource).toContain("<RoundAutoPuttStatus");
    expect(sceneSource).toContain("Green reached · automatic putt-out");
    expect(sceneSource).toContain("yd to mapped pin");
    expect(sceneSource).toContain('greenRule: "automatic_putts"');
    expect(sceneSource).toContain('greenRule: "manual_putts"');
    expect(sceneSource).toContain("simulateCourseTwinPutt(");
    expect(sceneSource).toContain("<ManualPuttingControls");
    expect(sceneSource).toContain("Play putts");
    expect(sceneSource).toContain("Approximate green");
    expect(sceneSource).toContain("Read next putt");
    expect(sceneSource).toContain("Course Twin strategy sandbox");
    expect(sceneSource).toContain("Strategy tool only.");
    expect(sceneSource).toContain("not added to Rounds");
    expect(sceneSource).toContain('activeRound.mode === "live" && activeRound.sessionId');
    expect(sceneSource).toContain("courseTwinVirtualClubOptions");
    expect(sceneSource).toContain("courseTwinVirtualShotKind");
    expect(sceneSource).toContain("courseTwinVirtualShotKindOptions");
    expect(sceneSource).toContain("Shot type");
    expect(sceneSource).toContain('if (kind === "half") return "Half shot"');
    expect(sceneSource).toContain("requestedShotKind: virtualShotKind");
    expect(sceneSource).toContain("Carry is scaled to this");
    expect(sceneSource).toContain("The mapped landing");
    expect(sceneSource).toContain("virtualCompletedTracers");
    expect(sceneSource).toContain("completedTracers={mode ===");
    expect(sceneSource).toContain("<NextShotMarker");
    expect(sceneSource).toContain("courseTwinGroundPositionsCoincide");
    expect(sceneSource).toContain("showFinishMarker={");
    expect(sceneSource).toContain("showCarryMarker={false}");
    expect(sceneSource).toContain("(!virtualShot || shot.clientEventId !== virtualRoundEventId)");
    expect(sceneSource).toContain(".sort((left, right) => left.shotNumber - right.shotNumber)");
    expect(sceneSource).toContain(".slice(-1)");
    expect(sceneSource).toContain("previousShot.flatMap");
    expect(sceneSource).toContain(
      "!courseTwinGroundPositionsCoincide(simulation.finalPosition, virtualStart)",
    );
    expect(sceneSource).toContain("sampleTerrain(position[0], position[2]) + 0.02");
    expect(sceneSource).toContain("nextShotStart: virtualShot ? null : virtualStart");
    expect(sceneSource).toContain("cameraStart={");
    expect(sceneSource).toContain("cameraUsesShotFraming");
    expect(sceneSource).toContain("courseTwinRoundHoleResumeState");
    expect(sceneSource).toContain("courseTwinRoundPhysicalHoleNumber");
    expect(sceneSource).toContain(
      "error instanceof CourseTwinRoundRequestError && error.status === 409",
    );
    expect(sceneSource).toContain("loadCourseTwinRoundClient(current.id)");
    expect(sceneSource).toContain("activeRoundPhysicalHoleNumber === selectedHole.holeNumber");
    expect(sceneSource).toContain("restorePersistedRoundHole(activeRound)");
    expect(sceneSource).toContain("selectedHole.holeNumber !== activeRoundPhysicalHoleNumber");
    expect(sceneSource).toContain("ledgerHoleNumber: activeRound.currentHole");
    expect(sceneSource).toContain("shot.holeNumber === activeRoundLedgerHoleNumber");
    expect(sceneSource).toContain('roundSync.error === "Shot is not on the current hole."');
    expect(sceneSource).toContain("courseTwinRoundScore(activeRound.summary.scorecard)");
    expect(sceneSource).toContain("Last hole ·");
    expect(sceneSource).toContain("automatic ${lastCompletedHole.putts}-putt from");
    expect(sceneSource).toContain('aria-label="Completed-hole scorecard"');
    expect(sceneSource).toContain(
      "{score.strokes} completed + {currentHoleStrokes} current = {playedStrokeCount} played",
    );
  });

  it("keeps live GSPro shots behind a paired loopback bridge and runs them through course physics", () => {
    expect(sceneSource).toContain('active={mode === "live"}');
    expect(sceneSource).toContain("new CourseTwinBridgeClient");
    expect(sceneSource).toContain("bridgeShotToReplayShot({");
    expect(sceneSource).toContain("const liveSimulation = useMemo");
    expect(sceneSource).toContain("liveShot,");
    expect(sceneSource).toContain("GSPro feed detected on this computer");
    expect(sceneSource).toContain("Only the next shot will");
  });

  it("uses instanced foliage billboards instead of procedural canopy blobs", () => {
    expect(sceneSource).toContain("useTexture");
    expect(sceneSource).toContain("<InstancedVegetation");
    expect(sceneSource).toContain("InstancedVegetationBillboard");
    expect(sceneSource).toContain("treeBillboards");
    expect(sceneSource).toContain("bushBillboards");
    expect(sceneSource).not.toContain("TreeCanopyLobes");
    expect(vegetationLedgerSource).toContain("Course Twin British Parkland Vegetation Billboards");
    expect(vegetationLedgerSource).toContain("OpenAI generated asset");
  });

  it("keeps replay focus on one shot and provides explicit camera controls", () => {
    expect(sceneSource).toContain("visibleShotCount:");
    expect(sceneSource).toContain('mode === "replay" && selectedShot');
    expect(sceneSource).toContain("{selectedShot ? (");
    expect(sceneSource).not.toContain("replayShots.map");
    expect(sceneSource).toContain("cameraStart={");
    expect(sceneSource).toContain("animatedShot?.totalEnd ??");
    expect(sceneSource).toContain("? virtualAimTarget");
    expect(sceneSource).toContain('label="Orbit camera left"');
    expect(sceneSource).toContain('label="Zoom camera in"');
    expect(sceneSource).toContain('label="Orbit camera right"');
  });

  it("frames golfer view from a believable eye-height position behind the ball", () => {
    expect(sceneSource).toContain("const GOLFER_SHOT_CAMERA =");
    expect(sceneSource).toContain("fov: 56");
    expect(sceneSource).toContain("behindDistance: 4.5");
    expect(sceneSource).toContain("lateralDistance: 0.85");
    expect(sceneSource).toContain("eyeHeight: 1.72");
    expect(sceneSource).toContain("const terrainStart = terrainSurfacePoint(start, sampleTerrain)");
    expect(sceneSource).toContain("terrainStart[1] + framing.eyeHeight");
    expect(sceneSource).toContain("terrainStart[1] + framing.eyeHeight - 0.35");
    expect(sceneSource).toContain("xl:sticky xl:top-14 xl:order-2 xl:h-[calc(100dvh-3.5rem)]");
    expect(sceneSource).toContain("const GOLFER_TEE_CAMERA =");
    expect(sceneSource).toContain("behindDistance: 14");
    expect(sceneSource).toContain("lateralDistance: 0");
    expect(sceneSource).toContain("eyeHeight: 1.72");
    expect(sceneSource).toContain("THREE.MathUtils.clamp(length * 0.62, 28, 85)");
  });

  it("lets the golfer aim from the ball and keeps the mapped centreline out of play", () => {
    expect(sceneSource).toContain("<ShotAimGuide");
    expect(sceneSource).toContain("courseTwinAimDirectionDegToPoint");
    expect(sceneSource).toContain('aria-label="Shot start direction"');
    expect(sceneSource).toContain("Click the course or move the slider");
    expect(sceneSource).toContain("depthTest={false}");
    expect(sceneSource).toContain("opacity={dimmed ? 0");
    expect(sceneSource).toContain("{!dimmed ? (");
    expect(sceneSource).toContain('? "crosshair" : "default"');
  });

  it("supports terrain-following walk and cart exploration without OrbitControls fighting movement", () => {
    expect(sceneSource).toContain('active={mode === "explore"}');
    expect(sceneSource).toContain("<RoamController");
    expect(sceneSource).toContain('transport === "cart"');
    expect(sceneSource).toContain('pressed.has("KeyW")');
    expect(sceneSource).toContain("point.y = sampleTerrain(point.x, point.z)");
    expect(sceneSource).toContain('mode === "explore" ? exploreTransport : null');
    expect(sceneSource).toContain("exploration:");
    expect(sceneSource).toContain("Start group session");
    expect(sceneSource).toContain("/api/course-twins/rooms/join");
    expect(sceneSource).toContain("groupSession:");
    expect(sceneSource).toContain("Join as {role}");
    expect(sceneSource).toContain("/shared-round/events");
    expect(sceneSource).toContain("Verified competition room");
  });

  it("does not let a late persisted-round response override a golfer-selected mode", () => {
    expect(sceneSource).toContain("const modeRef = useRef(mode)");
    expect(sceneSource).toContain("const modeAtLoad = modeRef.current");
    expect(sceneSource).toContain("if (modeRef.current === modeAtLoad)");
    expect(sceneSource).toContain('selectMode("explore")');
  });
});
