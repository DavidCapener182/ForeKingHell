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
const mobileStylesSource = readFileSync(
  resolve(process.cwd(), "src/app/play/[courseId]/course-twin-mobile.module.css"),
  "utf8",
);

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
    expect(sceneSource).toContain("<Collapsible");
    expect(sceneSource).toContain("<CollapsibleTrigger");
    expect(sceneSource).toContain("<CollapsibleContent");
    expect(sceneSource).not.toContain("<details");
  });

  it("bounds native selects to the six frame-sensitive Course Twin runtime trays", () => {
    expect(sceneSource.match(/<select\b/g) ?? []).toHaveLength(6);
    for (const control of [
      "Club plan",
      'aria-label="Shot type"',
      'aria-label="Club and modelled carry in yards"',
      'aria-label="Putt aim"',
      'aria-label="Putt pace"',
      'aria-label="Live club"',
    ]) {
      expect(sceneSource).toContain(control);
    }
  });

  it("presents Course Twin as a cinematic analysis canvas without removing its controls", () => {
    expect(sceneSource).toContain("<CinematicPerformanceHud");
    expect(sceneSource).toContain("Measured launch data · derived placement");
    expect(sceneSource).toContain("Modelled estimate from {strategy.sampleSize} measured shots");
    expect(sceneSource).toContain('type HudPanel = "course" | "analysis" | null');
    expect(sceneSource).toContain('aria-label="Open course controls"');
    expect(sceneSource).toContain('aria-label="Open analysis controls"');
    expect(sceneSource).toContain("<RuntimeDockButton");
    expect(sceneSource).toContain('label="Flyover"');
    expect(sceneSource).toContain('label="Replay"');
    expect(sceneSource).toContain('label="Strategy"');
    expect(sceneSource).toContain('label="Play"');
    expect(sceneSource).toContain('label="Live"');
    expect(sceneSource).toContain('label="Explore"');
  });

  it("renders photographic aerial courses with TikTok-style tracer sequences", () => {
    expect(sceneSource).toContain("course-twin-terrain-splat-v4-pbr-atlas");
    expect(sceneSource).toContain("replayCompletedTracers");
    expect(sceneSource).toContain("completedTracerColour");
    expect(sceneSource).toContain("<TracerNumberMarker");
    expect(sceneSource).toContain("lineWidth={active ? 10 : 7}");
    expect(sceneSource).toContain("<HoleNumberMarker");
    expect(sceneSource).toContain("strategyAreaTexture");
    expect(sceneSource).toContain(
      '.filter((hole) => cameraView === "golfer" || hole === selectedHole)',
    );
    expect(sceneSource).toContain(
      'cameraView === "aerial" && (mode === "replay" || mode === "strategy")',
    );
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
      "Recent shots for this club do not contain spin axis, so only a subtle curve is inferred from its latest 30-day left/right pattern.",
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
    expect(sceneSource).toContain("virtualStrategyClub?.clubType");
    expect(sceneSource).toContain("Shot type");
    expect(sceneSource).toContain('if (kind === "half") return "Half shot"');
    expect(sceneSource).toContain("requestedShotKind: virtualShotKind");
    expect(sceneSource).toContain("Carry is scaled to this");
    expect(sceneSource).toContain("The mapped landing");
    expect(sceneSource).toContain("virtualCompletedTracers");
    expect(sceneSource).toContain("completedTracers={");
    expect(sceneSource).toContain('mode === "replay"');
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
    expect(sceneSource).toContain("holes={manifest.holes}");
    expect(sceneSource).toContain("buildCourseTwinScreenTrees");
    expect(sceneSource).toContain("native screening vegetation");
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

  it("keeps 3D shot-number markers out of the close golfer view", () => {
    expect(sceneSource).toContain(
      'label={cameraView === "aerial" ? (selectedShot.holeShotNumber ?? undefined) : undefined}',
    );
    expect(sceneSource).toContain(
      'label={cameraView === "aerial" ? tracer.shotNumber : undefined}',
    );
    expect(sceneSource).toContain("scale={[4.2, 4.2, 1]}");
    expect(sceneSource).not.toContain("scale={[9.5, 9.5, 1]}");
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
    expect(pageSource).toContain("xl:h-[calc(100dvh-3.5rem)]");
    expect(pageSource).toContain("xl:overflow-hidden");
    expect(sceneSource).toContain("data-course-twin-stage");
    expect(sceneSource).toContain("data-course-twin-hud");
    expect(sceneSource).toContain("data-course-twin-primary-controls");
    expect(sceneSource).toContain("data-course-twin-shot-controls");
    expect(sceneSource).toContain("data-course-twin-hole-hud");
    expect(sceneSource).toContain("xl:absolute xl:inset-0");
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
    expect(sceneSource).toContain("modeRef.current === modeAtLoad)");
    expect(sceneSource).toContain('selectMode("explore")');
  });

  it("uses the full R3F Course Twin as an immersive mobile viewport", () => {
    expect(pageSource).toContain("course-twin-mobile.module.css");
    expect(pageSource).toContain("data-course-twin-viewport");
    expect(pageSource).toContain("mobileStyles.viewport");
    expect(pageSource).toContain('aria-label="Exit Course Twin"');
    expect(pageSource).toContain('href="/course-twins"');
    expect(pageSource).toContain("mobileStyles.exitButton");

    expect(sceneSource).toContain("<Canvas");
    expect(sceneSource).toContain("mobileStyles.stage");
    expect(sceneSource).toContain("mobileStyles.canvas");
    expect(sceneSource).toContain("<Drawer");
    expect(sceneSource).toContain("<Sheet");
    expect(sceneSource.match(/data-mobile-preserve-dark/g) ?? []).toHaveLength(3);

    expect(mobileStylesSource).toContain("position: fixed !important;");
    expect(mobileStylesSource).toContain("height: 100dvh !important;");
    expect(mobileStylesSource).toContain("env(safe-area-inset-top)");
    expect(mobileStylesSource).toContain("env(safe-area-inset-right)");
    expect(mobileStylesSource).toContain("env(safe-area-inset-bottom)");
    expect(mobileStylesSource).toContain("env(safe-area-inset-left)");
    expect(mobileStylesSource).toContain(".canvas canvas");
  });

  it("keeps the three primary mobile modes and shot actions over the scene", () => {
    expect(sceneSource).toContain("data-course-twin-mobile-chrome");
    expect(sceneSource).toContain("data-course-twin-mode-dock");
    expect(sceneSource).toContain("data-course-twin-action-tray");
    expect(sceneSource).toContain("mobileStyles.mobileChrome");
    expect(sceneSource).toContain("mobileStyles.modeDock");
    expect(sceneSource).toContain("mobileStyles.actionTray");
    expect(mobileStylesSource).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(mobileStylesSource).toContain("grid-template-columns: repeat(5, minmax(0, 1fr));");
    for (const label of ["Club", "Carry", "Target", "Shape / miss", "Next"]) {
      expect(sceneSource).toContain(`>${label}<`);
    }
    const mobileModeDockSource = mobileStylesSource.slice(
      mobileStylesSource.indexOf(".modeDock {\n    position: absolute;"),
      mobileStylesSource.indexOf(".modeButton {"),
    );
    expect(mobileModeDockSource).not.toContain("overflow-x");
    expect(mobileModeDockSource).toContain("overflow: hidden;");
    const mobileChromeSource = sceneSource.slice(
      sceneSource.indexOf("function MobileCourseTwinChrome"),
      sceneSource.indexOf("function MobileSummaryTray"),
    );
    expect(mobileChromeSource).toContain("spacing={0.5}");
    expect(mobileChromeSource).not.toContain("spacing={0}");
    expect(mobileStylesSource).toContain("min-height: 2.75rem;");
    expect(mobileStylesSource).toContain("touch-action: manipulation;");
    expect(mobileStylesSource).toContain("@media (max-height: 500px) and (orientation: landscape)");
  });

  it("uses a minimal custom HUD with ToggleGroup modes and on-demand controls", () => {
    expect(sceneSource).toContain("<CourseTwinMinimalHud");
    expect(sceneSource).toContain("<ToggleGroup");
    expect(sceneSource).toContain("<ToggleGroupItem");
    expect(sceneSource).toContain('aria-label="Open Course Twin settings"');
    expect(sceneSource).toContain('"Replay selection"');
    expect(sceneSource).toContain('"Personal strategy unavailable"');
    expect(sceneSource).toContain('label="Expected carry"');
    expect(sceneSource).toContain('label="Dispersion"');
    expect(sceneSource).toContain('label="Target"');
    expect(sceneSource).toContain('label="Carry"');
    expect(sceneSource).toContain('label="Hazards"');
    expect(sceneSource).not.toContain("<Card");
  });

  it("keeps the mobile Play tray compact without hiding modelled provenance", () => {
    expect(sceneSource).toContain("mobileStyles.compactPlayTray");
    expect(sceneSource).toContain("mobileStyles.compactShotToolbar");
    expect(sceneSource).toContain("data-course-twin-modelled-label");
    expect(mobileStylesSource).toContain(".compactPlayTray,");
    expect(mobileStylesSource).toContain(".compactShotToolbar {");
    expect(mobileStylesSource).toContain(".compactAimRange {");
    expect(mobileStylesSource).toContain("min-height: 2.75rem;");
  });

  it("keeps mobile Live, Explore and modelled putting controls honest and touch-operable", () => {
    expect(sceneSource).toContain("<MobileLiveControls");
    expect(sceneSource).toContain('aria-label="Six-digit pairing code"');
    expect(sceneSource).toContain('aria-label="Live club"');
    expect(sceneSource).toContain("Measured launch · reconstructed flight and mapped placement");
    expect(sceneSource).toContain('new CustomEvent("course-twin-roam-step"');
    expect(sceneSource).toContain('window.addEventListener("course-twin-roam-step"');
    expect(sceneSource).toContain('aria-label="Explore movement"');
    expect(sceneSource).toContain("Modelled putt holed");
    expect(sceneSource).toContain("outcome is not measured");
    expect(mobileStylesSource).toContain(".exploreControls {");
  });

  it("treats full-screen mobile panels as focus-managed modal dialogs", () => {
    expect(sceneSource).toContain("<DrawerContent");
    expect(sceneSource).toContain("<SheetContent");
    expect(sceneSource).toContain("open={Boolean(hudPanel)}");
    expect(sceneSource).toContain("hudReturnFocusRef");
    expect(sceneSource).toContain("toggleHudPanel");
    expect(sceneSource).toContain("closeHudPanel");
    expect(sceneSource).toContain('event.key !== "Tab"');
    expect(sceneSource).toContain(
      "inert={isCompactViewport && Boolean(hudPanel) ? true : undefined}",
    );
  });

  it("preserves the desktop Course Twin from the 1024px boundary", () => {
    expect(pageSource).toContain("xl:h-[calc(100dvh-3.5rem)]");
    expect(sceneSource).toContain("xl:h-full xl:min-h-0 xl:overflow-hidden");
    expect(mobileStylesSource).toContain("@media (max-width: 1023px)");
    expect(mobileStylesSource).toContain("@media (min-width: 1024px)");
    expect(mobileStylesSource).toContain(".mobileChrome,");
    expect(mobileStylesSource).toContain(".exitButton {");
    expect(mobileStylesSource).toContain("display: none;");
  });
});

it("preserves an explicit strategy or hole link while loading a resumable round", () => {
  expect(sceneSource).toContain(
    "!initialMode && !initialHoleNumber && modeRef.current === modeAtLoad",
  );
  expect(sceneSource).toContain("restorePersistedRoundHole(activeRound)");
});
