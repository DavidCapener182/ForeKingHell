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
    expect(sceneSource).toContain("Each shot is sampled from your measured carry and dispersion");
    expect(sceneSource).toContain("buildCourseTwinAutomaticGreenCompletion");
    expect(sceneSource).toContain("<RoundAutoPuttStatus");
    expect(sceneSource).toContain("Green reached · automatic putt-out");
    expect(sceneSource).toContain("yd to mapped pin");
    expect(sceneSource).toContain('greenRule: "automatic_putts"');
    expect(sceneSource).not.toContain("<RoundPuttActions");
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
    expect(sceneSource).toContain('visibleShotCount: mode === "replay" && selectedShot ? 1 : 0');
    expect(sceneSource).toContain("{selectedShot ? (");
    expect(sceneSource).not.toContain("replayShots.map");
    expect(sceneSource).toContain("shot?.start ?? hole.tee");
    expect(sceneSource).toContain("shot?.totalEnd ?? hole.green");
    expect(sceneSource).toContain('label="Orbit camera left"');
    expect(sceneSource).toContain('label="Zoom camera in"');
    expect(sceneSource).toContain('label="Orbit camera right"');
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
