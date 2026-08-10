import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/bag/page.tsx"), "utf8");

describe("bag desktop workbench source", () => {
  it("labels stock-confidence leadership as historical trust", () => {
    expect(source).toContain('label="Most trusted historically"');
    expect(source).not.toContain('label="Strongest club"');
  });

  it("keeps the AI bag rail as a large-monitor enhancement", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="bag"');
    expect(layoutBlock).toContain('railBreakpoint="wide"');
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI bag rail"');
  });

  it("defers peer benchmark data until the user requests comparison context", () => {
    expect(source).toContain("peers?: string | string[]");
    expect(source).toContain(
      "const peerBenchmarksLoaded = shouldLoadPeerBenchmarks(resolvedSearchParams.peers);",
    );
    expect(source).toContain("benchmarkRows.length > 0 && peerBenchmarksLoaded");
    expect(source).toContain("? await getPeerBenchmarkSummary(benchmarkRows)");
    expect(source).toContain(": emptyPeerSummary()");
    expect(source).toContain("function shouldLoadPeerBenchmarks");
    expect(source).toContain('rawValue === "1"');
    expect(source).toContain('rawValue === "true"');
    expect(source).toContain('rawValue === "yes"');
    expect(source).toContain("peerBenchmarksLoaded={peerBenchmarksLoaded}");
    expect(source).toContain('id="distance-benchmarks"');
  });

  it("keeps the desktop gapping table open, exportable and reachable as the main table", () => {
    const gappingBlock =
      source.match(/<details[\s\S]*?data-bag-gapping-table[\s\S]*?<\/details>/)?.[0] ?? "";

    expect(gappingBlock).toContain("open");
    expect(gappingBlock).toContain("DesktopTableWorkbenchControls");
    expect(gappingBlock).toContain('data-workbench-scope="bag"');
    expect(gappingBlock).toContain('data-workbench-export-table="bag-gapping"');
    expect(gappingBlock).toContain("mainTable");
    expect(gappingBlock).toContain('mainTableLabel="Full bag gapping table"');
    expect(gappingBlock).toContain("stickyFirstColumn");
  });

  it("keeps the wedge matrix as an exportable desktop table", () => {
    const wedgeBlock =
      source.match(/function WedgeMatrixPanel[\s\S]*?function PathTrendPanel/)?.[0] ?? "";

    expect(source).toContain("wedgeMatrixColumns");
    expect(source).toContain("wedgeMatrixSuggestedViews");
    expect(wedgeBlock).toContain("DesktopTableWorkbenchControls");
    expect(wedgeBlock).toContain('viewKey="bag-wedge-matrix"');
    expect(wedgeBlock).toContain('data-workbench-scope="bag-wedge-matrix"');
    expect(wedgeBlock).toContain('data-workbench-export-table="bag-wedge-matrix"');
    expect(wedgeBlock).toContain('exportFileName="forekinghell-wedge-matrix.csv"');
    expect(wedgeBlock).toContain('label="Wedge matrix carry table" stickyFirstColumn');
    expect(wedgeBlock).toContain("TableCaption");
    expect(wedgeBlock).toContain('id="wedge-matrix-carry-summary"');
    expect(wedgeBlock).toContain("tabIndex={0}");
    expect(wedgeBlock).toContain("focus-aaa outline-none");

    for (const column of ["club", "full", "three-quarter", "half", "status"]) {
      expect(wedgeBlock).toContain(`data-column="${column}"`);
    }
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

describe("bag mobile information architecture", () => {
  const mobileBlock = source.slice(
    source.indexOf("<MobileAppShell>"),
    source.indexOf("<DesktopWorkbenchLayout"),
  );

  it("puts the scannable owned-club list directly after the answer-first summary", () => {
    expect(mobileBlock.indexOf("<MobileBentoSummary")).toBeLessThan(
      mobileBlock.indexOf('title="Your clubs"'),
    );
    expect(mobileBlock).toContain('label: "Bag score"');
    expect(mobileBlock).toContain('label: "Next move"');
    expect(mobileBlock).toContain('label: "Weakest gap"');
    expect(mobileBlock).toContain("bag.map((club)");
    expect(mobileBlock).toContain("detail={club.brandModel}");
    expect(mobileBlock).toContain("value={mobileClubSignal(club)}");
    expect(mobileBlock).toContain("href={`/bag/${club.id}`}");
  });

  it("provides a first-use import action and keeps one recommendation visible", () => {
    expect(mobileBlock).toContain('label="No clubs imported"');
    expect(mobileBlock).toContain('href="/import"');
    expect(mobileBlock).toContain("Import your first shots");
    expect(mobileBlock).toContain('bag.length === 0 ? "Import shot data" : "Review next bag move"');
    expect(mobileBlock).toContain('label="Featured bag action"');
    expect(mobileBlock).toContain("bagDoctorFindings[0]");
  });

  it("moves supporting analysis into one native disclosure level", () => {
    expect(mobileBlock).toContain("<IOSDisclosureGroup");
    expect(mobileBlock).toContain('value: "personal-bests"');
    expect(mobileBlock).toContain('value: "gapping"');
    expect(mobileBlock).toContain('value: "benchmarks"');
    expect(mobileBlock).toContain('value: "lower-scores"');
    expect(mobileBlock).toContain('value: "bag-setup"');
    expect(mobileBlock).toContain('title: "Fitting and methodology"');
    expect(mobileBlock).not.toContain("MobileCompanionAccordion");
  });

  it("does not reintroduce desktop actions beside the tablet mobile shell", () => {
    expect(source).toContain('className="hidden items-center justify-between gap-4 lg:flex"');
    expect(source).not.toContain('className="hidden items-center justify-between gap-4 sm:flex"');
  });
});
