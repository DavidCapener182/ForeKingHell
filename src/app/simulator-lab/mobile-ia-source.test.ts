import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/simulator-lab/page.tsx"), "utf8");

function componentBody(name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Performance Lab desktop-only workbench architecture", () => {
  it("does not ship the obsolete companion and iOS render graph", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).not.toMatch(/getRequestAppSurface|MobileAppShell|MobileRouteHeader/);
    expect(source).not.toMatch(/IOS[A-Z]|MobilePerformanceLab|MobileFilterSheet/);
    expect(source).not.toMatch(/lg:hidden|hidden lg:|mobile=\{/);
  });

  it("preserves the decision-first workbench, specialist charts and evidence tables", () => {
    for (const feature of [
      "RangeRealityCockpit",
      "GappingMatrixClient",
      "SessionDeltaTable",
      "EquipmentImpactTable",
      "FlightLineMap",
      "WhatIfClient",
      "ConfidenceTimeline",
    ]) {
      expect(source).toContain(feature);
    }

    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("data-workbench-export-table");
    expect(source).toContain("aria-current");
  });

  it("uses semantic theme tokens for ordinary status and table surfaces", () => {
    const cockpit = componentBody("RangeRealityCockpit", "CoachSummaryCard");
    const tones = componentBody("toneTextClass", "practicePriorityLabel");
    const sessionTable = componentBody("SessionDeltaTable", "EquipmentImpactTable");

    expect(cockpit).toContain("var(--status-success-surface)");
    expect(cockpit).toContain("var(--status-warning-surface)");
    expect(tones).toContain("var(--status-information-foreground)");
    expect(tones).not.toMatch(/(?:text|bg)-(?:emerald|sky|amber|rose|slate)-/);
    expect(sessionTable).toContain("bg-card");
    expect(sessionTable).not.toContain("bg-white");
  });

  it("retains the deliberate specialist chart palette", () => {
    const chart = componentBody("ConfidenceTimeline", "FlightLineMap");
    expect(chart).toContain('fill="white"');
    expect(chart).toContain('stroke="#0B7A3B"');
  });
});
