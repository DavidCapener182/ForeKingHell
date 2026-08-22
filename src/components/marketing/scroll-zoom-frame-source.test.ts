import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/marketing/scroll-zoom-frame.tsx"),
  "utf8",
);
const marketingStyles = readFileSync(
  join(process.cwd(), "src/components/marketing/marketing.module.css"),
  "utf8",
);
const courseTwinFallback = readFileSync(
  join(process.cwd(), "src/components/marketing/course-twin/course-twin-static-fallback.tsx"),
  "utf8",
);

describe("marketing scroll zoom", () => {
  it("writes transforms only to opted-in moving elements and respects reduced motion", () => {
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain('addEventListener("scroll", requestUpdate, { passive: true })');
    expect(source).toContain("[data-scroll-zoom-target]");
    expect(source).toContain("target.style.transform");
    expect(source).not.toContain('element.style.setProperty("--marketing-zoom"');
    expect(source).not.toContain('element.style.setProperty("--marketing-scroll"');
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("removeEventListener");
    expect(source).toContain("const fallbackTargets = Array.from(");
    expect(source).toContain("if (fallbackTargets.length === 0) return");
    expect(source).toContain('addEventListener("change", syncMotion)');
    expect(source).toContain('removeEventListener("change", syncMotion)');
    expect(source).toContain('target.style.removeProperty("transform")');
  });

  it("only enables the native hero view-timeline when motion is allowed", () => {
    expect(marketingStyles).toMatch(
      /@media \(min-width: 768px\) and \(prefers-reduced-motion: no-preference\) \{\s*@supports \(animation-timeline: view\(\)\)/,
    );
    expect(marketingStyles).toContain("animation: marketing-hero-range-zoom linear both");
  });

  it("keeps specialist Course Twin evidence imagery stable", () => {
    expect(courseTwinFallback).not.toContain("data-scroll-zoom-target");
  });
});
