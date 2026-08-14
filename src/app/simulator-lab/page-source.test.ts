import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/simulator-lab/page.tsx"), "utf8");
const gappingSource = readFileSync(
  join(process.cwd(), "src/app/simulator-lab/gapping-matrix-client.tsx"),
  "utf8",
);

describe("simulator lab desktop workbench", () => {
  it("ships one desktop-only workbench tree", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).not.toMatch(/getRequestAppSurface|MobileAppShell|MobileRouteHeader|IOS[A-Z]/);
    expect(source).not.toMatch(
      /MobilePerformanceLab|MobileFilterSheet|MobileDataCard|MobileDataList/,
    );
    expect(source).not.toMatch(/lg:hidden|hidden lg:|mobile=\{/);
  });

  it("keeps simulator session deltas as an exportable desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("sessionDeltaColumns");
    expect(source).toContain("sessionDeltaSuggestedViews");
    expect(source).toContain('id="simulator-session-deltas"');
    expect(source).toContain('data-workbench-scope="simulator-session-deltas"');
    expect(source).toContain('viewKey="simulator-session-deltas"');
    expect(source).toContain("suggestedViews={sessionDeltaSuggestedViews}");
    expect(source).toContain('href: "/simulator-lab#simulator-session-deltas"');
    expect(source).toContain("Latest simulator changes");
    expect(source).toContain("Offline control check");
    expect(source).toContain('exportTableId="simulator-session-deltas"');
    expect(source).toContain('data-workbench-export-table="simulator-session-deltas"');
    expect(source).toContain('mainTableLabel="Simulator session delta table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-simulator-session-deltas.csv");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["club", "samples", "carry", "ball", "smash", "offline", "verdict"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps equipment impact as an exportable desktop workbench table", () => {
    expect(source).toContain("equipmentImpactColumns");
    expect(source).toContain("equipmentImpactSuggestedViews");
    expect(source).toContain('id="simulator-equipment-impact"');
    expect(source).toContain('data-workbench-scope="simulator-equipment-impact"');
    expect(source).toContain('viewKey="simulator-equipment-impact"');
    expect(source).toContain("suggestedViews={equipmentImpactSuggestedViews}");
    expect(source).toContain('href: "/simulator-lab#simulator-equipment-impact"');
    expect(source).toContain("Before/after equipment proof");
    expect(source).toContain("Equipment regressions");
    expect(source).toContain('exportTableId="simulator-equipment-impact"');
    expect(source).toContain('data-workbench-export-table="simulator-equipment-impact"');
    expect(source).toContain('label="Simulator equipment impact table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-simulator-equipment-impact.csv");

    for (const column of ["change", "samples", "carry", "ball", "smash", "offline", "verdict"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps simulator lab table and tool focused without a persistent AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("uses independent compact rails instead of stretching mismatched panels", () => {
    expect(source).toContain('className="grid items-start gap-5 xl:grid-cols-[0.68fr_1.32fr]"');
    expect(source).toContain('className="grid items-start gap-4 xl:grid-cols-[0.92fr_1.08fr]"');
    expect(source).toContain('className="grid items-start gap-5 xl:grid-cols-[0.9fr_1.1fr]"');
    expect(source).toContain('className="grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]"');
    expect(source).toContain('columnsClassName="grid-cols-1"');
  });

  it("keeps the handicap timeline wide and shallow", () => {
    const timelineBlock =
      source.match(/function ConfidenceTimeline[\s\S]*?function FlightLineMap/)?.[0] ?? "";

    expect(timelineBlock).toContain("const chartWidth = 1100");
    expect(timelineBlock).toContain("const chartHeight = 220");
    expect(timelineBlock).toContain('className="block h-auto min-w-[48rem] w-full"');
  });

  it("puts selected-club context above the full gapping matrix", () => {
    expect(gappingSource).toContain('<div className="grid gap-4">');
    expect(gappingSource).toContain(
      "xl:grid-cols-[minmax(12rem,0.65fr)_minmax(28rem,1.25fr)_minmax(16rem,0.8fr)]",
    );
    expect(gappingSource).not.toContain("xl:grid-cols-[minmax(0,1fr)_320px]");
    expect(gappingSource).not.toContain('className="xl:col-span-2"');
  });
});
