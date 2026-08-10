import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/maps/shot-pattern-map.tsx"),
  "utf8",
);

describe("shot pattern mobile specialist flow", () => {
  it("keeps the map primary and moves setup into an accessible mobile sheet", () => {
    const trigger = source.indexOf("data-mobile-shot-pattern-trigger");
    const map = source.indexOf("shot-pattern-mobile-map");

    expect(source).toContain("data-mobile-shot-pattern-controls");
    expect(source).toContain('role={mobileControlsOpen ? "dialog" : undefined}');
    expect(source).toContain("aria-expanded={mobileControlsOpen}");
    expect(source).toContain('aria-controls="shot-pattern-mobile-controls"');
    expect(source).toContain('aria-label="Close shot pattern setup"');
    expect(source).toContain("closeOnEscape");
    expect(source).toContain("min-h-11");
    expect(source).toContain("hidden lg:block");
    expect(source).toContain("lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]");
    expect(trigger).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(trigger);
  });

  it("leaves the specialist course and satellite canvases intact", () => {
    expect(source).toContain("<HoleVectorFallback");
    expect(source).toContain("ref={setMapContainerRef}");
    expect(source).toContain('setMapMode("course")');
    expect(source).toContain('setMapMode("satellite")');
    expect(source).toContain("targetLineStatusLabel");
  });
});
