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
});
