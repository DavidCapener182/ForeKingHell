import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SHOT_PLANS } from "./course-twin/course-twin-data";

const root = process.cwd();
const readSource = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

const showcaseSource = readSource("src/components/marketing/course-twin-showcase.tsx");
const runtimeSource = readSource("src/components/marketing/course-twin-demo-runtime.tsx");
const sceneSource = readSource("src/components/marketing/course-twin/course-twin-scene.tsx");
const hudSource = readSource("src/components/marketing/course-twin/course-twin-hud.tsx");
const foliageSource = readSource("src/components/marketing/course-twin/course-twin-foliage.tsx");
const fallbackSource = readSource(
  "src/components/marketing/course-twin/course-twin-static-fallback.tsx",
);

const courseTwinSourcePaths = [
  "src/components/marketing/course-twin-demo-runtime.tsx",
  "src/components/marketing/course-twin/course-twin-data.ts",
  "src/components/marketing/course-twin/course-twin-foliage.tsx",
  "src/components/marketing/course-twin/course-twin-geometry.ts",
  "src/components/marketing/course-twin/course-twin-hud.tsx",
  "src/components/marketing/course-twin/course-twin-scene.tsx",
  "src/components/marketing/course-twin/course-twin-shot-path.tsx",
  "src/components/marketing/course-twin/course-twin-static-fallback.tsx",
  "src/components/marketing/course-twin/course-twin-terrain.tsx",
  "src/components/marketing/course-twin/course-twin-textures.ts",
] as const;
const combinedCourseTwinSource = courseTwinSourcePaths.map(readSource).join("\n");

describe("marketing Course Twin source contract", () => {
  it("keeps the R3F runtime capability-gated and dynamically loaded near the section", () => {
    expect(showcaseSource).toMatch(/useInViewOnce<HTMLElement>\("[1-9][0-9]*px 0px"\)/);
    expect(showcaseSource).toContain('import("./course-twin-demo-runtime")');
    expect(showcaseSource).toContain("if (!isVisible || !capability.canLoad || Runtime) return");
    expect(showcaseSource).toContain("prefers-reduced-motion: reduce");
    expect(showcaseSource).toContain("connection?.saveData");
    expect(showcaseSource).toContain('connection?.effectiveType === "slow-2g"');
    expect(showcaseSource).toContain('connection?.effectiveType === "2g"');
    expect(showcaseSource).toContain('canvas.getContext("webgl2")');
    expect(showcaseSource).toContain('canvas.getContext("webgl")');
    expect(showcaseSource).toContain('canvas.getContext("experimental-webgl")');
    expect(showcaseSource).not.toMatch(/from ["'](?:@react-three\/|three["'])/);
  });

  it("uses the same responsive WebGL scene on compact and full viewports with no SVG planner", () => {
    expect(showcaseSource).not.toContain("compactViewport");
    expect(showcaseSource).not.toContain('matchMedia("(max-width: 767px)")');
    expect(showcaseSource).not.toContain("CourseTwinPlan");
    expect(
      existsSync(join(root, "src/components/marketing/course-twin/course-twin-plan.tsx")),
    ).toBe(false);
    expect(combinedCourseTwinSource).not.toMatch(/<svg\b/i);

    expect(runtimeSource).toContain('from "@react-three/fiber"');
    expect(runtimeSource).toContain("<Canvas");
    expect(runtimeSource).toContain("data-course-twin-runtime");
    expect(runtimeSource).toContain("data-quality={quality}");
    expect(runtimeSource).toContain('"compact"');
    expect(runtimeSource).toContain('"full"');
  });

  it("caps render cost while keeping deterministic, instanced course detail", () => {
    expect(runtimeSource).toContain('frameloop="demand"');
    expect(runtimeSource).toContain('dpr={quality === "compact" ? 1 : [1, 1.5]}');
    expect(sceneSource).toContain("CourseTwinTerrain");
    expect(sceneSource).toContain("CourseTwinFoliage");
    expect(foliageSource).toContain("THREE.InstancedMesh");
    expect(foliageSource).toContain("<instancedMesh");
    expect(combinedCourseTwinSource).toContain("seededUnit");
    expect(combinedCourseTwinSource).not.toContain("Math.random");
    expect(combinedCourseTwinSource).toContain(".dispose()");
  });

  it("keeps the safer 3 Wood and longer Driver plans materially distinct", () => {
    const threeWood = SHOT_PLANS["three-wood"];
    const driver = SHOT_PLANS.driver;

    expect(threeWood.label).toBe("3 Wood");
    expect(driver.label).toBe("Driver");
    expect(driver.carryYards).toBeGreaterThan(threeWood.carryYards);
    expect(driver.apexMetres).toBeGreaterThan(threeWood.apexMetres);
    expect(driver.dispersion.radiusX).toBeGreaterThan(threeWood.dispersion.radiusX);
    expect(driver.dispersion.radiusZ).toBeGreaterThan(threeWood.dispersion.radiusZ);
    expect(driver.landing).not.toEqual(threeWood.landing);
    expect(driver.targetLabel).not.toBe(threeWood.targetLabel);
    expect(driver.missLabel).not.toBe(threeWood.missLabel);
  });

  it("keeps controls and every essential plan metric in accessible DOM content", () => {
    expect(hudSource).toMatch(/<fieldset\b|role="radiogroup"/);
    expect(hudSource).toContain('aria-label="Choose planned club"');
    expect(hudSource).toContain("3 Wood");
    expect(hudSource).toContain("Driver");
    expect(hudSource).toContain("aria-pressed");
    expect(hudSource).toMatch(/<(?:button|Button)\b/);
    expect(hudSource).toContain("Replay shot plan");
    expect(hudSource).toContain('aria-live="polite"');
    expect(hudSource).toContain("Expected carry (modelled)");
    expect(hudSource).toContain("Safe target (modelled)");
    expect(hudSource).toContain("Common miss (modelled)");
    expect(hudSource).toContain("Trajectory (modelled)");
    expect(hudSource).toContain("Plan basis");
    expect(runtimeSource).toContain('aria-hidden="true"');
  });

  it("uses responsive premium raster fallback art within the asset budgets", () => {
    expect(fallbackSource).toContain("<picture");
    expect(fallbackSource).toMatch(/<source\s+media="\(max-width: 767px\)"/);
    expect(fallbackSource).toContain("/assets/generated/course-twin-premium-desktop.avif");
    expect(fallbackSource).toContain("/assets/generated/course-twin-premium-desktop.webp");
    expect(fallbackSource).toContain("/assets/generated/course-twin-premium-mobile.avif");
    expect(fallbackSource).toContain("/assets/generated/course-twin-premium-mobile.webp");
    expect(fallbackSource).toContain("data-course-twin-fallback");

    const assets = [
      ["course-twin-premium-desktop.avif", 350 * 1024],
      ["course-twin-premium-desktop.webp", 350 * 1024],
      ["course-twin-premium-mobile.avif", 180 * 1024],
      ["course-twin-premium-mobile.webp", 180 * 1024],
    ] as const;

    for (const [asset, maximumBytes] of assets) {
      const assetPath = join(root, "public/assets/generated", asset);
      expect(existsSync(assetPath), `${asset} should be generated locally`).toBe(true);
      expect(statSync(assetPath).size, `${asset} should remain optimised`).toBeLessThan(
        maximumBytes,
      );
    }
  });
});
