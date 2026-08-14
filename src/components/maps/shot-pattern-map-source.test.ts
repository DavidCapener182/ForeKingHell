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
    expect(source).toContain("<ResponsiveDetailPanel");
    expect(source).toContain("inlineAtDesktop");
    expect(source).toContain("aria-expanded={mobileControlsOpen}");
    expect(source).toContain('aria-controls="shot-pattern-mobile-controls"');
    expect(source).not.toContain("closeOnEscape");
    expect(source).not.toContain('role={mobileControlsOpen ? "dialog" : undefined}');
    expect(source).toContain("min-h-11");
    expect(source).toContain("<Select");
    expect(source).toContain('id="shot-pattern-tee-set"');
    expect(source).toContain('id="shot-pattern-club"');
    expect(source).not.toContain("<select");
    expect(source).toContain("<Card");
    expect(source).toContain("<Badge");
    expect(source).toContain("<Spinner");
    expect(source).toContain('<Alert variant="destructive"');
    expect(source).toContain("Updating pattern...");
    expect(source).not.toMatch(/<p className="[^"]*(?:red-|bg-red)/);
    expect(source).not.toContain("bg-black/60");
    expect(source).not.toContain("bg-[#0B7A3B]");
    expect(source).not.toContain("border-slate-200 bg-white");
    expect(source).not.toContain('className="bg-white/82"');
    expect(source).toContain('className="bg-card/80"');
    expect(source).toMatch(/<Spinner className="size-4" \/>[\s\S]*Shot pattern data is loading/);
    expect(source).toContain("inlineAtDesktop");
    expect(source).not.toContain('mobileControlsOpen ? "block" : "hidden lg:block"');
    expect(source).toContain("lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]");
    expect(trigger).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(trigger);
  });

  it("leaves the specialist course and satellite canvases intact", () => {
    expect(source).toContain("<HoleVectorFallback");
    expect(source).toContain("ref={setMapContainerRef}");
    expect(source).toContain("<ChartAccessibleFallback");
    expect(source).toContain("<svg");
    expect(source).toContain('setMapMode("course")');
    expect(source).toContain('setMapMode("satellite")');
    expect(source).toContain("targetLineStatusLabel");
  });

  it("uses shadcn fields and sliders for ordinary distance and aim controls", () => {
    const setupControls =
      source.match(/data-mobile-shot-pattern-controls[\s\S]*?<\/ResponsiveDetailPanel>/)?.[0] ?? "";

    expect(source).toContain('from "@/components/ui/input"');
    expect(source).toContain('from "@/components/ui/slider"');
    expect(setupControls).toContain('<Input\n                aria-label="Playing length yards"');
    expect(setupControls).toContain('<Slider\n                  aria-label="Target distance"');
    expect(setupControls).toContain('<Input\n                  aria-label="Target distance yards"');
    expect(setupControls).toContain('<Slider\n                  aria-label="Aim offset"');
    expect(setupControls).toContain('<Input\n                  aria-label="Aim offset yards"');
    expect(setupControls).not.toContain("<input");
    expect(setupControls).not.toContain('type="range"');
  });
});
