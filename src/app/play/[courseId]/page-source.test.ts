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
    expect(pageSource).toContain("<CourseTwinRuntime manifest={manifest} replay={replay} />");
  });

  it("keeps Three.js in a client-only dynamically loaded route bundle", () => {
    expect(runtimeSource).toContain('"use client"');
    expect(runtimeSource).toContain("ssr: false");
    expect(runtimeSource).toContain('import("./course-twin-scene")');
    expect(sceneSource).toContain('from "three"');
    expect(pageSource).not.toContain('from "three"');
  });

  it("keeps quality and replay provenance visible to golfers", () => {
    expect(sceneSource).toContain("Grade {manifest.quality.grade} prototype");
    expect(sceneSource).toContain("Measured metrics · derived course placement");
    expect(sceneSource).toContain("manifest.attribution.map");
    expect(dataSource).toContain("Map data from OpenStreetMap contributors");
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
    expect(sceneSource).toContain("visibleShotCount: selectedShot ? 1 : 0");
    expect(sceneSource).toContain("{selectedShot ? (");
    expect(sceneSource).not.toContain("replayShots.map");
    expect(sceneSource).toContain("shot?.start ?? hole.tee");
    expect(sceneSource).toContain("shot?.totalEnd ?? hole.green");
    expect(sceneSource).toContain('label="Orbit camera left"');
    expect(sceneSource).toContain('label="Zoom camera in"');
    expect(sceneSource).toContain('label="Orbit camera right"');
  });
});
