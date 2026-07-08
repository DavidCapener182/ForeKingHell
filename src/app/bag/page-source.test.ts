import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/bag/page.tsx"), "utf8");

describe("bag desktop workbench source", () => {
  it("keeps the AI bag rail as a large-monitor enhancement", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="bag"');
    expect(layoutBlock).toContain('railBreakpoint="2xl"');
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI bag rail"');
  });

  it("keeps the desktop gapping table open, exportable and reachable as the main table", () => {
    const gappingBlock =
      source.match(/<details[\s\S]*?data-bag-gapping-table[\s\S]*?<\/details>/)?.[0] ?? "";

    expect(gappingBlock).toContain("open");
    expect(gappingBlock).toContain("DesktopTableWorkbenchControls");
    expect(gappingBlock).toContain('data-workbench-export-table="bag-gapping"');
    expect(gappingBlock).toContain("mainTable");
    expect(gappingBlock).toContain('mainTableLabel="Full bag gapping table"');
  });

  it("keeps bag pattern charts explainable with fallback tables", () => {
    const overlayPanelBlock =
      source.match(
        /function ShotPatternOverlayPanel[\s\S]*?function CourseStrategyModePanel/,
      )?.[0] ?? "";
    const overlaySvgBlock =
      source.match(/function PatternOverlaySvg[\s\S]*?function shotPatternOverlaySummary/)?.[0] ??
      "";

    expect(overlayPanelBlock).toContain("ChartAccessibleFallback");
    expect(overlayPanelBlock).toContain("title={`${overlay.label} shot pattern`}");
    expect(overlayPanelBlock).toContain("summary={shotPatternOverlaySummary(overlay)}");
    expect(overlayPanelBlock).toContain("rows={shotPatternOverlayRows(overlay)}");
    expect(overlayPanelBlock).toContain('{ key: "metric", label: "Metric" }');
    expect(overlaySvgBlock).toContain('role="img"');
    expect(overlaySvgBlock).toContain("aria-label={`${overlay.label} shot pattern overlay`}");
  });

  it("keeps club evolution confidence-led instead of blunt health labels", () => {
    const evolutionBlock =
      source.match(/function ClubEvolutionPanel[\s\S]*?function stockTrendLabel/)?.[0] ?? "";
    const evolutionReadoutBlock =
      source.match(
        /function clubEvolutionReadout[\s\S]*?function clubEvolutionConfidenceLabel/,
      )?.[0] ?? "";
    const healthBlock =
      source.match(/function clubHealthReadout[\s\S]*?function stableBagLabel/)?.[0] ?? "";

    expect(evolutionBlock).toContain(
      "Monthly median carry from clean-stock shots, with sample size and retest confidence.",
    );
    expect(evolutionBlock).toContain("point.sampleSize");
    expect(evolutionBlock).toContain("clubEvolutionReadout(club, measuredPoints)");
    expect(evolutionBlock).toContain("Playable today, carry down versus");
    expect(evolutionBlock).toContain("Do not change swing unless ball");
    expect(evolutionBlock).toContain("Driver ball speed today");
    expect(evolutionReadoutBlock).toContain('label: "Monitor carry"');
    expect(evolutionReadoutBlock).toContain("Retest 10 stock shots");
    expect(evolutionReadoutBlock).toContain("delta <= -8");
    expect(evolutionBlock).not.toContain(">Health<");
    expect(healthBlock).toContain('label: "Distance retest"');
    expect(healthBlock).toContain('label: "Pattern check"');
    expect(healthBlock).not.toContain('label: "Needs attention"');
  });
});
