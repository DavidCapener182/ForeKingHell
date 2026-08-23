import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const assetDirectory = join(root, "public/assets/landing");

const assets = [
  ["hero-course-desktop.avif", 190 * 1024],
  ["hero-course-mobile.avif", 130 * 1024],
  ["hero-golfer.webp", 150 * 1024],
  ["course-twin-hole.avif", 290 * 1024],
  ["course-twin-mobile.avif", 150 * 1024],
  ["practice-range.avif", 90 * 1024],
  ["practice-job.avif", 100 * 1024],
  ["product-today.avif", 70 * 1024],
  ["product-bag.avif", 70 * 1024],
  ["product-practice.avif", 85 * 1024],
  ["final-green-desktop.avif", 65 * 1024],
  ["final-green-mobile.avif", 90 * 1024],
  ["golf-ball.png", 80 * 1024],
] as const;

describe("cinematic marketing assets", () => {
  it("ships every generated image inside the public asset namespace and budget", () => {
    let totalBytes = 0;

    for (const [filename, maximumBytes] of assets) {
      const assetPath = join(assetDirectory, filename);
      expect(existsSync(assetPath), `${filename} should exist`).toBe(true);
      const bytes = statSync(assetPath).size;
      totalBytes += bytes;
      expect(bytes, `${filename} should remain optimised`).toBeLessThan(maximumBytes);
    }

    expect(totalBytes).toBeLessThan(1_450 * 1024);
  });

  it("keeps separate mobile compositions for the opening, Course Twin and closing scenes", () => {
    expect(statSync(join(assetDirectory, "hero-course-mobile.avif")).size).not.toBe(
      statSync(join(assetDirectory, "hero-course-desktop.avif")).size,
    );
    expect(statSync(join(assetDirectory, "final-green-mobile.avif")).size).not.toBe(
      statSync(join(assetDirectory, "final-green-desktop.avif")).size,
    );
    expect(statSync(join(assetDirectory, "course-twin-mobile.avif")).size).not.toBe(
      statSync(join(assetDirectory, "course-twin-hole.avif")).size,
    );
  });

  it("uses the generated golf ball for the hero and the cross-section continuity flight", () => {
    const heroSource = readFileSync(
      join(root, "src/components/marketing/hero-product-stage.tsx"),
      "utf8",
    );
    const continuitySource = readFileSync(
      join(root, "src/components/marketing/story-continuity.tsx"),
      "utf8",
    );

    expect(heroSource).toContain("/assets/landing/golf-ball.png");
    expect(continuitySource).toContain('from "next/image"');
    expect(continuitySource).toContain("/assets/landing/golf-ball.png");
    expect(continuitySource).toContain("className={styles.storyContinuityTracer}");
    expect(continuitySource).toContain("firstControlX");
    expect(continuitySource).toContain("startY = viewportHeight * 1.07");
    expect(continuitySource).toContain('section: "pricing"');
  });
});
