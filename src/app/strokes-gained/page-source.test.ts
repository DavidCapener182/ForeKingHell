import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/strokes-gained/page.tsx"), "utf8");

describe("strokes gained desktop workbench", () => {
  it("keeps one desktop-only workbench while companion traffic redirects", () => {
    expect(source).toContain(
      'title={activeCategory ? `${activeCategory.label} strokes gained` : "Strokes gained"}',
    );
    expect(source).toContain("description={heroDescription(analysis, activeCategory)}");
    expect(source).not.toContain("MobileRouteTabs");
    expect(source).not.toContain("MobileScoringDiagnosis");
    expect(source).not.toContain("MobileCategorySummary");
    expect(source).not.toContain("MobileStrokesGainedDisclosures");
    expect(source).not.toContain("@/components/app/ios-mobile");
    expect(source).not.toContain("lg:hidden");
    expect(source).not.toContain("hidden lg:");
    expect(source).not.toContain("Tee is the main scoring leak");
  });

  it("keeps the AI strokes-gained rail as shared wide-monitor context", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="strokes-gained"');
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI strokes-gained rail"');
  });

  it("gives the shot-event table saved views, column control, export and accessible metadata", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="strokes-gained-events"');
    expect(source).toContain('scope="strokes-gained"');
    expect(source).toContain('exportTableId="strokes-gained-events"');
    expect(source).toContain('data-workbench-scope="strokes-gained"');
    expect(source).toContain('data-workbench-export-table="strokes-gained-events"');
    expect(source).toContain('mainTableLabel="Strokes gained event table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("sticky left-0 top-0 z-20");
    expect(source).toContain("sticky left-0 z-10 min-w-48");
    expect(source).toContain("strokesGainedSuggestedViews");

    for (const column of [
      "round",
      "hole",
      "category",
      "from",
      "to",
      "distance",
      "expected-before",
      "expected-after",
      "sg",
      "status",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the gain/loss waterfall chart explainable with fallback rows", () => {
    const waterfallBlock =
      source.match(/function GainLossWaterfall[\s\S]*?function PracticeThisFirstCard/)?.[0] ?? "";

    expect(waterfallBlock).toContain('role="img"');
    expect(waterfallBlock).toContain('aria-label="Strokes gained waterfall"');
    expect(waterfallBlock).toContain("ChartAccessibleFallback");
    expect(waterfallBlock).toContain('title="Strokes gained waterfall"');
    expect(waterfallBlock).toContain("summary={waterfallSummary}");
    expect(waterfallBlock).toContain("rows={waterfallRows}");
    expect(waterfallBlock).toContain('{ key: "category", label: "Category" }');
    expect(waterfallBlock).toContain('{ key: "pendingEvents", label: "Pending events" }');
    expect(waterfallBlock).toContain('viewBox="0 0 760 150"');
    expect(waterfallBlock).toContain("max-w-full");
    expect(waterfallBlock).toContain("md:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]");
    expect(waterfallBlock).not.toContain("compactMobile");
    expect(waterfallBlock).not.toContain("[&>details]:hidden");
  });

  it("keeps the scoring diagnosis and round history compact", () => {
    const leakBlock =
      source.match(/function MainScoringLeak[\s\S]*?function scoringLeakArtwork/)?.[0] ?? "";
    const roundBlock =
      source.match(/function RoundTrendPanel[\s\S]*?function HoleImpactPanel/)?.[0] ?? "";

    expect(leakBlock).toContain("md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]");
    expect(leakBlock).not.toContain("Recommended practice");
    expect(leakBlock).toContain("sm:grid-cols-[minmax(15rem,0.85fr)_minmax(0,1.15fr)]");
    expect(leakBlock).toContain("aspect-[3/2] min-h-44");
    expect(source).toContain('className: "object-center"');
    expect(roundBlock).toContain('className="grid gap-3 md:grid-cols-2"');
    expect(roundBlock).toContain("const displayedRounds = rounds.slice(0, 6)");
  });

  it("eager-loads the above-the-fold scoring leak artwork", () => {
    const leakBlock =
      source.match(/function MainScoringLeak[\s\S]*?function scoringLeakArtwork/)?.[0] ?? "";

    expect(leakBlock).toContain('loading="eager"');
    expect(leakBlock).toContain('fetchPriority="high"');
  });

  it("keeps gains and losses content-sized without filler space", () => {
    const highlightBlock =
      source.match(/function ShotHighlights[\s\S]*?function RoundTrendPanel/)?.[0] ?? "";

    expect(highlightBlock).toContain('<section className="grid items-start gap-4 md:grid-cols-2">');
    expect(highlightBlock).toContain("<DataPanel>");
    expect(highlightBlock).not.toContain("<DataPanel stretch>");
    expect(highlightBlock).toContain('className="grid gap-2"');
    expect(highlightBlock).toContain(
      'className="mt-1 truncate text-sm leading-5 text-muted-foreground"',
    );
    expect(highlightBlock).not.toContain("auto-rows-fr");
  });

  it("keeps category comparison dense at tablet and desktop widths", () => {
    const breakdownBlock =
      source.match(/function CategoryBreakdown[\s\S]*?function CategorySummaryTile/)?.[0] ?? "";

    expect(breakdownBlock).toContain('className="grid gap-2.5 md:grid-cols-2"');
    expect(breakdownBlock).toContain("border-border bg-card");
    expect(breakdownBlock).toContain(
      'className="mt-2 grid h-2.5 grid-cols-2 overflow-hidden rounded-full',
    );
    expect(breakdownBlock).not.toContain("sm:grid-cols-[3rem_11rem_minmax(0,1fr)_5rem]");
  });

  it("keeps one event filter and evidence table without a mobile duplicate", () => {
    expect(source).not.toContain("IOSDisclosureGroup");
    expect(source).not.toContain("IOSGroupedList");
    expect(source).not.toContain("MobileDataList");
    expect(source.match(/<StrokesGainedFilterForm/g)).toHaveLength(1);
    expect(source.match(/id="events"/g)).toHaveLength(1);
    expect(source.match(/id="strokes-gained-events-summary"/g)).toHaveLength(1);
  });

  it("uses semantic theme tokens for ordinary cards, diagnosis and table controls", () => {
    const categories =
      source.match(/function CategoryCard[\s\S]*?function CalculationCoverageStrip/)?.[0] ?? "";
    const leak =
      source.match(/function MainScoringLeak[\s\S]*?function scoringLeakArtwork/)?.[0] ?? "";
    const table =
      source.match(/function StrokesGainedEventTable[\s\S]*?function SgValue/)?.[0] ?? "";
    const toneHelpers = source.match(/function sgTextClassName[\s\S]*?function first/)?.[0] ?? "";

    for (const block of [categories, leak, table, toneHelpers]) {
      expect(block).toContain("var(--");
      expect(block).not.toMatch(
        /(?:bg|text|border|ring)-(?:white|slate|emerald|green|amber|orange|red|rose|sky|blue|indigo|violet|purple)(?:-\d+|\/)|rgba\(15,23,42/,
      );
      expect(block).not.toMatch(/#(?:111827|667085|B42318|087A3D|E5E7EB)/i);
    }
    expect(source).toContain('const fill = value >= 0 ? "#087A3D" : "#DC2626"');
  });
});
