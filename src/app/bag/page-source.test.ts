import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/bag/page.tsx"), "utf8");
const targetDistanceSource = readFileSync(
  join(process.cwd(), "src/app/bag/target-distance-selector.tsx"),
  "utf8",
);
const lazyBagSimulatorSource = readFileSync(
  join(process.cwd(), "src/app/bag/lazy-bag-simulator.tsx"),
  "utf8",
);

describe("bag desktop workbench source", () => {
  it("uses the condensed shadcn bag workspace and responsive selected-club detail", () => {
    const clubPanel = readFileSync(
      join(process.cwd(), "src/app/bag/club-intelligence-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("data-bag-health-card");
    expect(source).toContain("<ConnectedMetricBar");
    expect(source).toContain("<AppEmptyState");
    for (const tab of ["distances", "clubs", "scoring", "fitting", "history"]) {
      expect(source).toContain(`value="${tab}"`);
    }
    expect(clubPanel).toContain("<ResponsiveDetailPanel");
    expect(clubPanel).toContain("<EntityCombobox");
    expect(clubPanel).toContain("inlineAtUltrawide");
    expect(clubPanel).toContain("data-selected-club-detail-trigger");
    const responsiveDetail =
      clubPanel.match(/<ResponsiveDetailPanel[\s\S]*?<\/ResponsiveDetailPanel>/)?.[0] ?? "";
    expect(responsiveDetail).toContain("<ConnectedMetricBar");
    expect(responsiveDetail).toMatch(/<ConnectedMetricBar\s+embedded/);
    expect(responsiveDetail).not.toContain("<Card");
    expect(clubPanel).not.toContain('aria-label="Select a club"\n          className="-mx-4 flex');
    expect(clubPanel).toContain('fill="var(--card)"');
    expect(clubPanel).toContain('stroke="var(--border)"');
    expect(clubPanel).toContain("var(--status-success-surface)");
    expect(clubPanel).not.toMatch(/(?:bg|border|text)-(?:emerald|sky|amber|rose)-/);
    expect(clubPanel).not.toContain('fill="#');
  });

  it("keeps Bag health metrics and signals flat inside the outer hero Card", () => {
    const healthHero =
      source.match(/function BagHealthHero[\s\S]*?function BagScoreTrendPanel/)?.[0] ?? "";
    const healthSignal =
      source.match(/function BagHealthSignal[\s\S]*?function BagScoreTrendPanel/)?.[0] ?? "";

    expect(healthHero).toMatch(/<ConnectedMetricBar\s+embedded/);
    expect(healthHero.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(healthSignal).toContain("<Item");
    expect(healthSignal).toContain("data-bag-health-signal");
    expect(healthSignal).not.toContain("<Card");
    expect(healthSignal).not.toContain("<ConnectedMetricBar");
  });

  it("keeps each desktop tab decision-first and groups secondary evidence", () => {
    const workspace = source.slice(
      source.indexOf("<Tabs defaultValue={activeTab}"),
      source.indexOf("function BagSupportingEvidence"),
    );

    expect(workspace).toContain("<BagSupportingEvidence");
    expect(workspace).toContain('title="Full gapping evidence"');
    expect(workspace).toContain('title="Club supporting tools"');
    expect(workspace).toContain('title="Scoring supporting evidence"');
    expect(workspace).toContain('title="Fitting supporting evidence"');
    expect(workspace).toContain('title="History supporting evidence"');
    expect(source).toContain("data-bag-supporting-evidence");
    expect(source).toContain("<Collapsible>");
    expect(source).toContain("parseBagWorkspaceTab");
    expect(source).toContain('id="bag-gapping-table"');
    expect(source).toContain('id="wedge-roles"');
    expect(source).toContain('id="club-evolution"');

    const supportingEvidence =
      source.match(
        /function BagSupportingEvidence[\s\S]*?async function getBagChallengeData/,
      )?.[0] ?? "";
    expect(supportingEvidence).toContain("<section");
    expect(supportingEvidence).not.toContain("<Card");
    expect(supportingEvidence).not.toContain("<CardHeader");
    expect(supportingEvidence).not.toContain("<CardContent");

    const tabWithoutSupportingEvidence = (value: string) => {
      const nextTab = value === "history" ? "</Tabs>" : '<TabsContent value="';
      const tab = workspace.slice(
        workspace.indexOf(`<TabsContent value="${value}"`),
        workspace.indexOf(nextTab, workspace.indexOf(`<TabsContent value="${value}"`) + 1),
      );
      return tab.replace(/<BagSupportingEvidence[\s\S]*?<\/BagSupportingEvidence>/g, "");
    };

    expect(tabWithoutSupportingEvidence("distances")).not.toContain("<BagSpeedPotentialPanel");
    expect(tabWithoutSupportingEvidence("distances")).not.toContain("<CarryGappingTable");
    expect(tabWithoutSupportingEvidence("clubs")).not.toContain("<PersonalBestSnapshotPanel");
    expect(tabWithoutSupportingEvidence("scoring")).not.toContain("<ShotPatternOverlayPanel");
    expect(tabWithoutSupportingEvidence("fitting")).not.toContain("<AiCaddiePanel");
    expect(tabWithoutSupportingEvidence("history")).not.toContain("<BenchmarkReferencePanel");
  });

  it("shows the leading gapping decision as an Alert and discloses full evidence", () => {
    const confidence =
      source.match(/function BagConfidenceLadder[\s\S]*?function buildBagDoctorFindings/)?.[0] ??
      "";
    const gapping =
      source.match(/function CarryGappingTable[\s\S]*?function GappingRecommendations/)?.[0] ?? "";

    expect(confidence).toContain("data-bag-gapping-doctor");
    expect(confidence).toContain("<Alert");
    expect(confidence).toContain("<Collapsible");
    expect(confidence).toContain("<CollapsibleTrigger");
    expect(confidence).toContain("buttonVariants({");
    expect(confidence).not.toContain("<CollapsibleTrigger asChild>");
    expect(confidence).not.toContain('title="Gapping doctor"');
    expect(gapping).toContain("data-full-gapping-evidence");
    expect(gapping).not.toContain('<Card className="min-w-0 overflow-hidden');
  });

  it("uses direct Radix triggers with shared shadcn button variants for bag disclosures", () => {
    const supportingEvidence =
      source.match(
        /function BagSupportingEvidence[\s\S]*?async function getBagChallengeData/,
      )?.[0] ?? "";
    const stockFilters =
      source.match(/function StockFilterPanel[\s\S]*?function StockFilterCards/)?.[0] ?? "";
    const evolution =
      source.match(/function ClubEvolutionPanel[\s\S]*?function stockTrendLabel/)?.[0] ?? "";

    for (const disclosure of [supportingEvidence, stockFilters, evolution]) {
      expect(disclosure).toContain("<CollapsibleTrigger");
      expect(disclosure).toContain("buttonVariants({");
      expect(disclosure).not.toContain("<CollapsibleTrigger asChild>");
      expect(disclosure).not.toMatch(/<button\b/);
    }
    expect(stockFilters).not.toContain("<CollapsibleContent asChild>");
  });

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

  it("loads the fitting-only bag simulator outside the initial route graph", () => {
    expect(source).toContain('import { LazyBagSimulator } from "@/app/bag/lazy-bag-simulator"');
    expect(source).toContain("<LazyBagSimulator");
    expect(source).not.toContain('from "@/app/bag/bag-simulator"');
    expect(lazyBagSimulatorSource).toContain('"use client"');
    expect(lazyBagSimulatorSource).toContain("dynamic<{ clubs: BagSimulatorClub[] }>");
    expect(lazyBagSimulatorSource).toContain('import("@/app/bag/bag-simulator")');
    expect(lazyBagSimulatorSource).toContain("<BagSimulatorSkeleton");
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
      source.match(/function CarryGappingTable[\s\S]*?function GappingRecommendations/)?.[0] ?? "";

    expect(source).toContain('<TabsContent value="distances"');
    expect(gappingBlock).not.toContain("<details");
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
        /function ShotPatternOverlayPanel[\s\S]*?function ConfidenceHeatMapPanel/,
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

describe("bag desktop-only bundle boundary", () => {
  it("keeps the obsolete bag companion stack out of the desktop route", () => {
    for (const obsoleteSymbol of [
      "MobileAppShell",
      "MobileTopBar",
      "MobileTabBar",
      "MobileBentoSummary",
      "MobileAccordionSection",
      "MobileDataCard",
      "MobileDataList",
      "StickyMobileAction",
      "NativeListSection",
      "IOSDisclosureGroup",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
      "IOSSectionHeader",
      "MobileBagGappingDetails",
      "MobileBagBenchmarkDetails",
      "MobileBagMethodology",
      "MobileClubArtworkCarousel",
      "mobileClubSignal",
      "mobileBenchmarkMetricSummary",
      "mobileBagStatusTone",
    ]) {
      expect(source).not.toContain(obsoleteSymbol);
    }

    expect(source).not.toContain("@/components/app/ios-mobile");
    expect(source).not.toContain("@/components/mobile-sports");
    expect(source).toContain('<DesktopWorkbenchLayout\n        scope="bag"');
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).toContain('className="flex items-center justify-between gap-4"');
    expect(source).toContain("data-bag-workspace");
  });

  it("keeps the target selector desktop-only, shadcn-controlled and theme semantic", () => {
    for (const obsoleteSymbol of [
      "MobileAccordionSection",
      "MobileTargetMetric",
      "targetDistanceYardsMobile",
      "DataPanel",
      "CardContent",
    ]) {
      expect(targetDistanceSource).not.toContain(obsoleteSymbol);
    }

    expect(targetDistanceSource).toContain("data-target-distance-selector");
    expect(targetDistanceSource).toContain("<Field");
    expect(targetDistanceSource).toContain("<FieldLabel");
    expect(targetDistanceSource).toContain("<Input");
    expect(targetDistanceSource).not.toContain("<input");
    expect(targetDistanceSource).toContain("bg-card");
    expect(targetDistanceSource).toContain("text-muted-foreground");
    expect(targetDistanceSource).toContain("var(--status-success-surface)");
    expect(targetDistanceSource).not.toMatch(
      /(?:bg|border|text)-(?:white|slate|emerald|amber|rose|sky)-/,
    );
    expect(targetDistanceSource).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it("keeps ordinary bag cards and tables semantic while preserving golf chart palettes", () => {
    expect(source).not.toMatch(
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#/,
    );
    expect(source).not.toContain("rgba(");
    expect(source).toContain("var(--status-warning-foreground)");
    expect(source).toContain("var(--status-information-foreground)");
    expect(source).toContain("shadow-[1px_0_0_hsl(var(--border))]");

    const specialistChart = source.slice(
      source.indexOf("function PatternOverlaySvg"),
      source.indexOf("function shotPatternOverlaySummary"),
    );
    expect(specialistChart).toContain("var(--chart-plot-background, #F8FAFC)");
  });
});
