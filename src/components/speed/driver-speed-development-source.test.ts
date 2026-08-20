import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/speed/driver-speed-development.tsx"),
  "utf8",
);

describe("driver speed development source", () => {
  it("uses the shared evidence summary and the existing premium workbench primitives", () => {
    expect(source).toContain(
      'import type { SpeedDevelopmentSummary } from "@/lib/speed-development"',
    );
    expect(source).toContain('import { SPEED_LADDER_LEVELS } from "@/lib/speed-development"');
    expect(source).toContain("export function DriverSpeedDevelopment");
    expect(source).toContain("data: SpeedDevelopmentSummary");

    for (const primitive of [
      "DataPanel",
      "SectionHeader",
      "StatusPill",
      "CompactReadoutGrid",
      "Button",
      "Progress",
    ]) {
      expect(source).toContain(primitive);
    }
  });

  it("keeps the answer-first programme hierarchy in one full-width surface", () => {
    const markers = [
      "data-speed-project-readiness",
      "data-speed-transfer-funnel",
      "data-speed-chaos",
      "data-speed-session-plan",
      "data-speed-ladder",
      "data-speed-verdict",
    ];

    let previousIndex = -1;
    for (const marker of markers) {
      const markerIndex = source.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(previousIndex);
      previousIndex = markerIndex;
    }

    expect(source).toContain("data-driver-speed-development");
    expect(source).toContain("min-w-0");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
  });

  it("offers one primary programme action inside the existing Practice route", () => {
    expect(source.match(/href="\/practice\?session=speed&intent=speed&time=20"/g)).toHaveLength(1);
    expect(source).toContain("Open recommended session");
    expect(source).toContain("View swing-by-swing evidence");
    expect(source).toContain("/speed/sessions/${summary.verdict.sessionId}");
  });

  it("renders the explicit four-stage transfer chain and fixed evidence-led ladder", () => {
    for (const stage of ["ceiling", "transfer", "playing", "course"]) {
      expect(source).toContain(`key: "${stage}"`);
    }

    expect(source).toContain("SPEED_LADDER_LEVELS.map");
    expect(source).toContain("summary.funnel.find");
    expect(source).toContain("summary.ladder.levels.find");
    expect(source.match(/<ol\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("keeps missing measurements explicit and announces the live readiness read", () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-atomic="true"');
    expect(source).toContain('return "Not measured"');
    expect(source).toContain("Loss from previous stage not measured");
    expect(source).toContain("Qualifying sessions not measured");
    expect(source).toContain("summary.verdict ?");
    expect(source).toContain("summary.verdict.nextAction");
  });

  it("does not hard-code example drive results or add a competing mobile or AI surface", () => {
    for (const example of ["216.6", "98.4", "93.2", "90.1", "89.4", "88.6", "18.7"]) {
      expect(source).not.toContain(example);
    }

    for (const competingSurface of [
      "DesktopInsightRail",
      "WorkbenchPrompts",
      "@/components/app/ios-mobile",
      "lg:hidden",
      "mobile={",
    ]) {
      expect(source).not.toContain(competingSurface);
    }
  });

  it("uses semantic theme tokens for ordinary workbench UI", () => {
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-muted/30");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-information-surface)");
    expect(source).not.toMatch(
      /\b(?:bg-white|text-slate-|border-slate-|bg-red-|bg-emerald-|bg-amber-|text-white)\b/,
    );
  });
});
