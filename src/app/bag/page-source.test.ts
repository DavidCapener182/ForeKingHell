import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/bag/page.tsx"), "utf8");
const responsiveStyles = readFileSync(
  join(process.cwd(), "src/app/(app)/bag/bag-page.module.css"),
  "utf8",
);
const targetDistanceSource = readFileSync(
  join(process.cwd(), "src/app/bag/target-distance-selector.tsx"),
  "utf8",
);
const lazyBagSimulatorSource = readFileSync(
  join(process.cwd(), "src/app/bag/lazy-bag-simulator.tsx"),
  "utf8",
);
const mobileYardageCarouselSource = readFileSync(
  join(process.cwd(), "src/app/bag/mobile-bag-yardage-carousel.tsx"),
  "utf8",
);

describe("bag desktop workbench source", () => {
  it("keeps Yardages and Target primary while moving Benchmarks to secondary disclosure", () => {
    expect(source).toContain("data-bag-mobile-full");
    expect(source).not.toContain("data-bag-mobile-quick-only");
    expect(source).toContain('title="My Bag"');
    expect(source).toContain("<MobilePageTabs");
    expect(source).toContain('label: "Yardages"');
    expect(source).toContain('label: "Target"');
    const mobileTabsStart = source.indexOf("<MobilePageTabs");
    const mobileTabsEnd = source.indexOf("\n        />", mobileTabsStart);
    const mobileTabs = source.slice(mobileTabsStart, mobileTabsEnd);
    expect(mobileTabs).not.toContain('label: "Benchmarks"');
    expect(source).toContain('<p className="font-semibold text-foreground">Benchmarks</p>');
    expect(source).toContain("mobile=benchmarks#bag-benchmarks");
    expect(source).toContain("<MobileBagYardageCarousel");
    expect(source).toContain("<DistanceBenchmarkPanel");
    expect(source).toContain("<QuickBagClient");
    expect(source).toContain("row.latestReliableCarryP25Yd");
    expect(source).toContain("row.targetMessage");
  });

  it("splits companion data work at the request surface boundary", () => {
    const companion =
      source.match(/async function BagCompanionPage[\s\S]*?async function BagWorkbenchPage/)?.[0] ??
      "";

    expect(source).toContain('import { getRequestAppSurface } from "@/lib/app-surface-server"');
    expect(source.indexOf("getRequestAppSurface()")).toBeLessThan(
      source.indexOf("<BagCompanionPage"),
    );
    expect(companion).toContain(
      'getBag({ scope: mobileBenchmarksLoaded ? "companion-benchmarks" : "companion" })',
    );
    expect(companion).toContain("mobileBenchmarksLoaded ? buildBenchmarkRows(bag) : []");
    expect(companion).not.toContain("getFeatureIdeasData()");
    expect(companion).not.toContain("getBagSpeedSummary()");
    expect(companion).not.toContain("getBagEquipmentContext()");
    expect(companion).not.toContain("buildWedgeMatrix(bag)");
    expect(companion).not.toContain("buildShotPatternOverlaySummaries(bag)");
    expect(companion).not.toContain("buildConfidenceHeatMaps(bag)");
    expect(source).toContain('const includeBenchmarkEvidence = scope !== "companion"');
    expect(source).toContain('const includePersonalBest = scope === "workbench"');
    expect(source).toContain("includePersonalBest && allClubMemberIds.length > 0");
    expect(source).toContain("includeBenchmarkEvidence\n      ? db");
  });

  it("derives mobile Bag selection from the URL and keeps the summary compact", () => {
    const summary =
      source.match(/function MobileBagSummary[\s\S]*?function BagSupportingEvidence/)?.[0] ?? "";

    expect(source).toContain("parseMobileBagPrimaryView(searchParams.view)");
    expect(source).toContain("initialValue={initialView}");
    expect(source).toContain('href: "/bag?view=yardages#bag-yardages"');
    expect(source).toContain('href: "/bag?view=target#bag-quick"');
    expect(summary).toContain("Bag {bagScore}");
    expect(summary).toContain("{trustedClubCount}/{gappingClubCount} trusted");
    expect(summary).toContain("{averageConfidence}% confidence");
    expect(summary).not.toContain("ios-grouped-row");
  });

  it("contains every mobile Bag section within the phone content width", () => {
    expect(responsiveStyles).toContain(".mobileSurface > section > *");
    expect(responsiveStyles).toMatch(/\.mobileSurface > section > \*[\s\S]*?min-width:\s*0/);
  });

  it("uses a swipeable yardage carousel with progressive disclosure", () => {
    expect(mobileYardageCarouselSource).toContain("<Carousel");
    expect(mobileYardageCarouselSource).toContain("<CarouselContent");
    expect(mobileYardageCarouselSource).toContain("<CarouselItem");
    expect(mobileYardageCarouselSource).toContain("basis-[calc(100%-1.5rem)]");
    expect(mobileYardageCarouselSource).toContain("<MobileCarouselPagination");
    expect(mobileYardageCarouselSource).toContain('ariaLabel="Choose bag club"');
    expect(mobileYardageCarouselSource).toContain("clubs.length <= 5");
    expect(mobileYardageCarouselSource).toContain('<Accordion type="single" collapsible>');
    expect(mobileYardageCarouselSource).toContain("Range, gap and next step");
  });

  it("uses the condensed shadcn bag workspace and responsive selected-club detail", () => {
    const clubPanel = readFileSync(
      join(process.cwd(), "src/app/bag/club-intelligence-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("data-bag-health-card");
    expect(source).toContain("<ConnectedMetricBar");
    expect(source).toContain("<AppEmptyState");
    for (const tab of ["distances", "clubs", "scoring", "fitting", "history", "evidence"]) {
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

  it("keeps Bag health metrics and signals flat inside the premium hero surface", () => {
    const healthHero =
      source.match(/function BagHealthHero[\s\S]*?function BagScoreTrendPanel/)?.[0] ?? "";
    const healthSignal =
      source.match(/function BagHealthSignal[\s\S]*?function BagScoreTrendPanel/)?.[0] ?? "";

    expect(healthHero).toMatch(/<ConnectedMetricBar\s+embedded/);
    expect(healthHero).toContain("<section");
    expect(healthHero).not.toContain("<Card");
    expect(healthSignal).toContain("<div");
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
    expect(workspace).toContain('title="Fitting experiment tools"');
    expect(workspace).not.toContain('title="History supporting evidence"');
    expect(source).toContain("data-bag-supporting-evidence");
    expect(source).toContain("<Collapsible>");
    expect(source).toContain("parseBagWorkspaceTab");
    expect(source).toContain('id="bag-gapping-table"');
    expect(source).toContain('id="club-evolution"');

    const supportingEvidence =
      source.match(/function BagSupportingEvidence[\s\S]*?function FittingStudio/)?.[0] ?? "";
    expect(supportingEvidence).toContain("<section");
    expect(supportingEvidence).not.toContain("<Card");
    expect(supportingEvidence).not.toContain("<CardHeader");
    expect(supportingEvidence).not.toContain("<CardContent");

    const tabWithoutSupportingEvidence = (value: string) => {
      const start = workspace.indexOf(`<TabsContent value="${value}"`);
      const nextTab = workspace.indexOf('<TabsContent value="', start + 1);
      const end = nextTab === -1 ? workspace.indexOf("</Tabs>", start) : nextTab;
      const tab = workspace.slice(start, end);
      return tab.replace(/<BagSupportingEvidence[\s\S]*?<\/BagSupportingEvidence>/g, "");
    };

    expect(tabWithoutSupportingEvidence("distances")).not.toContain("<BagSpeedPotentialPanel");
    expect(tabWithoutSupportingEvidence("distances")).not.toContain("<CarryGappingTable");
    expect(tabWithoutSupportingEvidence("clubs")).not.toContain("<PersonalBestSnapshotPanel");
    expect(tabWithoutSupportingEvidence("scoring")).not.toContain("<ShotPatternOverlayPanel");
    expect(tabWithoutSupportingEvidence("fitting")).not.toContain("<AiCaddiePanel");
    expect(tabWithoutSupportingEvidence("history")).not.toContain("<BenchmarkReferencePanel");

    const evidenceTab = tabWithoutSupportingEvidence("evidence");
    expect(evidenceTab).toContain("<BagScoreTrendPanel");
    expect(evidenceTab).toContain("<ClubEvolutionPanel");
    expect(evidenceTab).toContain("<BenchmarkReferencePanel");
    expect(evidenceTab).not.toContain("<BagSupportingEvidence");
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
        /function BagSupportingEvidence[\s\S]*?async function getBagSpeedSummary/,
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

  it("leads with the trusted-number answer and three explicit bag checks", () => {
    expect(source).toContain("clubs have trusted numbers");
    expect(source).toContain('label="Largest gap"');
    expect(source).toContain('label="Weakest confidence"');
    expect(source).not.toContain('label="Current scoring concern"');
    expect(source).toContain('label="Next bag action"');
  });

  it("removes the permanent AI rail and keeps one contextual bag question", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="bag"');
    expect(layoutBlock).not.toContain("DesktopInsightRail");
    expect(layoutBlock).not.toContain("rail={");
    expect(source).toContain("Ask about my bag");
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
      source.match(/function WedgeMatrixPanel[\s\S]*?function ShotPatternOverlayPanel/)?.[0] ?? "";

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

  it("balances monthly carry movement with measured lateral control", () => {
    const evolution =
      source.match(/function ClubEvolutionPanel[\s\S]*?function DriverEvolutionContextCard/)?.[0] ??
      "";
    const readout =
      source.match(
        /function clubEvolutionReadout[\s\S]*?function clubEvolutionConfidenceLabel/,
      )?.[0] ?? "";

    expect(evolution).toContain("median offline");
    expect(evolution).toContain(">Carry<");
    expect(evolution).toContain(">Control<");
    expect(evolution).toContain("clubEvolutionControlDelta");
    expect(readout).toContain('label: "Straighter trade-off"');
    expect(readout).toContain("not a distance regression");
    expect(readout).toContain('label: "Control improved"');
    expect(readout).toContain('label: "Pattern wider"');
  });

  it("builds distance benchmarks from a transparent best-30 average", () => {
    const benchmarkBuilder =
      source.match(
        /function buildBenchmarkRows[\s\S]*?async function getPeerBenchmarkSummary/,
      )?.[0] ?? "";

    expect(benchmarkBuilder).toContain("CLUB_BENCHMARK_CARRY_SAMPLE_SIZE");
    expect(benchmarkBuilder).toContain("averageSampleSize: BENCHMARK_CARRY_CANDIDATE_SIZE");
    expect(benchmarkBuilder).toContain(
      "benchmarkCandidates.slice(0, CLUB_BENCHMARK_CARRY_SAMPLE_SIZE)",
    );
    expect(benchmarkBuilder).toContain("sampleCarryYards");
    expect(benchmarkBuilder).toContain("savedShotCount: club.rawShotCount");
    expect(benchmarkBuilder).not.toContain("carryYd: club.stock.bestStockCarryYd");
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
      "Monthly median carry and offline control from the same clean-stock shots.",
    );
    expect(evolutionBlock).toContain("point.sampleSize");
    expect(evolutionBlock).toContain("clubEvolutionReadout(club, measuredPoints)");
    expect(evolutionBlock).toContain("Playable today, carry down versus");
    expect(evolutionBlock).toContain("Do not change swing unless ball");
    expect(evolutionBlock).toContain("Driver ball speed today");
    expect(evolutionReadoutBlock).toContain(
      'label: isRetest ? "Distance retest" : "Monitor carry"',
    );
    expect(evolutionReadoutBlock).toContain("Retest 10 stock shots");
    expect(evolutionReadoutBlock).toContain("delta <= -8");
    expect(evolutionBlock).not.toContain(">Health<");
    expect(healthBlock).toContain('label: "Distance retest"');
    expect(healthBlock).toContain('label: "Pattern check"');
    expect(healthBlock).not.toContain('label: "Needs attention"');
  });
});

describe("bag desktop and Quick Bag boundary", () => {
  it("keeps the full workbench desktop-only and makes Quick Bag the mobile surface", () => {
    for (const obsoleteSymbol of [
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
    expect(source).toContain("@/components/mobile-sports");
    expect(source).toContain("<MobileTopBar");
    expect(source).toContain('<section className="grid gap-5" data-bag-mobile-full>');
    expect(source).toContain("<QuickBagClient");
    expect(source).not.toContain("data-bag-mobile-quick-only");
    expect(source).toContain("data-bag-mobile-surface");
    expect(source).toContain("data-bag-desktop-surface");
    expect(source).toContain("<DesktopWorkbenchLayout");
    expect(source).toContain('scope="bag"');
    expect(source).toContain("styles.mobileSurface");
    expect(source).toContain("styles.desktopSurface");
    expect(responsiveStyles).not.toContain("@media (min-width: 64rem)");
    expect(responsiveStyles).toContain(".mobileSurface");
    expect(responsiveStyles).toContain(".mobileSurface > section");
    expect(responsiveStyles).toContain(".desktopSurface");
    expect(source).toContain('if (surface === "companion")');
    expect(source).toContain("return <BagCompanionPage");
    expect(source).toContain("return <BagWorkbenchPage");
    expect(source).not.toContain('href="/dashboard"');
    expect(source).not.toContain("Import CSV");
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
