import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/progress/page.tsx"), "utf8");
const diagnosisSource = readFileSync(
  join(process.cwd(), "src/components/progress/distance-loss-diagnosis-panel.tsx"),
  "utf8",
);
const lazyTrendSource = readFileSync(
  join(process.cwd(), "src/components/progress/lazy-metric-trend-card.tsx"),
  "utf8",
);

describe("progress desktop workbench source", () => {
  it("owns the multifactor distance-loss diagnosis rather than treating it as speed training", () => {
    expect(source).toContain("getDistanceLossDiagnosisData(userId)");
    expect(source).toContain("DistanceLossDiagnosisPanel");
    expect(source).toContain("diagnosis={distanceLossDiagnosis}");

    const recapIndex = source.indexOf("<WeeklyRecapPanel");
    const diagnosisIndex = source.indexOf("<DistanceLossDiagnosisPanel");
    expect(recapIndex).toBeGreaterThan(-1);
    expect(diagnosisIndex).toBeGreaterThan(recapIndex);
  });

  it("uses the optional desktop AI rail without crowding laptop workbenches", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="progress"');
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI progress rail"');
    expect(layoutBlock).toContain('railBreakpoint="wide"');
    expect(layoutBlock).toContain("progressInsightMetrics(summary, scoringEvidence)");
    expect(layoutBlock).toContain("progressInsightEvidence(summary)");
    expect(layoutBlock).not.toContain('railBreakpoint="2xl"');
    expect(source).toContain("progressWorkbenchPrompts");
    expect(source).toContain('label: "Explain progress trend"');
    expect(source).toContain('label: "Compare with last month"');
    expect(source).toContain('label: "Save this insight"');
    expect(source).toContain('if (surface === "companion")');
    expect(source).toContain('await import("@/components/app/desktop-workbench")');
    expect(source).not.toMatch(
      /import\s*\{[^}]*DesktopWorkbenchLayout[^}]*\}\s*from\s*["']@\/components\/app\/desktop-workbench["']/,
    );
  });

  it("deletes the retired desktop panel wall instead of retaining hidden implementations", () => {
    for (const retired of [
      "function PracticePlanPanel",
      "function PracticePriorityFeatureCard",
      "function CoachReadoutPanel",
      "function TrustLadderPanel",
    ]) {
      expect(source).not.toContain(retired);
    }
  });

  it("preserves one flat desktop bag-movement evidence table and CSV export", () => {
    const bagMovementBlock =
      source.match(/async function BagMovementPanel[\s\S]*?function MovementPills/)?.[0] ?? "";

    expect(source.match(/<BagMovementPanel\b/g)).toHaveLength(1);
    expect(source.match(/data-workbench-export-table="progress-bag-movement"/g)).toHaveLength(1);
    expect(bagMovementBlock).toContain("DesktopTableWorkbenchControls");
    expect(bagMovementBlock).toContain("DataTableFrame");
    expect(bagMovementBlock).toContain('exportFileName="forekinghell-progress-bag-movement.csv"');
    expect(bagMovementBlock).toContain('data-column="trust"');
    expect(bagMovementBlock).toContain('data-column="clean-shots"');
    expect(bagMovementBlock).toContain('data-column="stock-carry"');
    expect(bagMovementBlock).toContain('data-column="movement"');
    expect(bagMovementBlock).toContain("row.trustIndex");
    expect(bagMovementBlock).toContain("row.sampleSize");
    expect(bagMovementBlock).toContain("row.stockCarryYd");
    expect(bagMovementBlock).toContain("<MovementPills");
    expect(bagMovementBlock).not.toContain("IOSGroupedList");
  });

  it("keeps the progress trend chart explainable with a text summary and data-table fallback", () => {
    const trendsBlock =
      source.match(/function ProgressTrendsPanel[\s\S]*?function Sparkline/)?.[0] ?? "";

    expect(trendsBlock).toContain("ChartAccessibleFallback");
    expect(trendsBlock).toContain('title="Progress trends"');
    expect(trendsBlock).toContain("summary={progressTrendChartSummary(summary.trends)}");
    expect(trendsBlock).toContain("rows={trendRows}");
    expect(trendsBlock).toContain("<LazyMetricTrendCard");
    expect(trendsBlock).toContain('{ key: "trend", label: "Trend" }');
    expect(trendsBlock).toContain('{ key: "readout", label: "Readout" }');
  });

  it("consolidates the desktop bento wall into four focused workbench tabs", () => {
    expect(source).toContain("data-progress-workspace");
    expect(source).toContain('aria-label="Progress workspace"');
    for (const tab of ["performance", "goals", "load", "timeline"]) {
      expect(source).toContain(`value="${tab}"`);
    }
    const desktopComposition =
      source.match(
        /<div className="contents" data-progress-workbench>[\s\S]*?<\/DesktopWorkbenchLayout>/,
      )?.[0] ?? "";
    expect(desktopComposition).not.toContain("<PracticePlanPanel");
    expect(desktopComposition).not.toContain("<CoachReadoutPanel");
    expect(source).not.toContain("<PracticeCalendarPanel");
    expect(desktopComposition).not.toContain("<TrustLadderPanel");
    expect(desktopComposition.match(/<BagMovementPanel\b/g)).toHaveLength(1);
    expect(source).toContain('<div id="journey" className="scroll-mt-28">');
    expect(source).not.toContain("data-progress-bento-item");
    expect(source).toContain("<LazyMetricTrendCard");
    expect(source).toContain("<ConnectedMetricBar");
    expect(desktopComposition).not.toContain("<ProgressScorePanel");
    expect(desktopComposition).not.toContain("<ComparisonBar");
    expect(source).toContain("data-progress-roadmap");
    expect(source).toContain("data-coach-timeline");
    expect(source).toContain("<StatusTimeline");
  });

  it("keeps Recharts out of the progress route's initial client graph", () => {
    expect(source).toContain(
      'import { LazyMetricTrendCard } from "@/components/progress/lazy-metric-trend-card"',
    );
    expect(source).not.toContain('from "@/components/app/metric-trend-card"');
    expect(lazyTrendSource).toContain('"use client"');
    expect(lazyTrendSource).toContain("dynamic<LazyMetricTrendCardProps>");
    expect(lazyTrendSource).toContain('import("@/components/app/metric-trend-card")');
    expect(lazyTrendSource).toContain("<MetricTrendCardSkeleton");
    expect(lazyTrendSource).not.toContain('from "recharts"');
  });

  it("gives mobile one answer-first progress readout before any supporting disclosure", () => {
    const mobileComposition =
      source.match(
        /if \(surface === "companion"\)[\s\S]*?data-progress-companion[\s\S]*?await import\("@\/components\/app\/desktop-workbench"\)/,
      )?.[0] ?? "";

    expect(mobileComposition).toContain("<MobileProgressAnswer");
    expect(mobileComposition).toContain("<MobileProgressDisclosures");
    expect(mobileComposition.indexOf("<MobileProgressAnswer")).toBeLessThan(
      mobileComposition.indexOf("<MobileProgressDisclosures"),
    );
    expect(source).toContain("data-mobile-progress-answer");
    expect(source).toContain('label="Strongest movement"');
    expect(source).toContain('label="Weakest area"');
    expect(source).toContain("review.nextAction.value");
    expect(source).toContain("dataGap.detail");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).not.toContain("bg-amber-500/10");
    expect(source).toContain('aria-label="Overall progress score"');
    expect(source).not.toContain("<MobileTabBar");
    expect(source).toContain("data-progress-workbench");
    expect(source).not.toMatch(/(?:^|\s)(?:lg:hidden|hidden lg:)/);
  });

  it("uses one single-open iOS disclosure group for the six secondary progress areas", () => {
    const disclosureBlock =
      source.match(/function MobileProgressDisclosures[\s\S]*?function MobileWeeklyRecap/)?.[0] ??
      "";

    expect(disclosureBlock).toContain("<IOSDisclosureGroup");
    for (const value of [
      "this-week",
      "trends",
      "practice",
      "coach-evidence",
      "bag-movement",
      "journey",
    ]) {
      expect(disclosureBlock).toContain(`value: "${value}"`);
    }
    expect(disclosureBlock).toContain(
      'defaultValue={openBagByDefault ? "bag-movement" : undefined}',
    );
    expect(disclosureBlock).not.toContain("<details");
  });

  it("keeps companion bag movement native and separate from the desktop export table", () => {
    const mobileBagBlock =
      source.match(/function MobileBagMovement[\s\S]*?function MobileProgressJourney/)?.[0] ?? "";

    expect(source).toContain("data-progress-companion");
    expect(source).not.toContain('className="min-w-[1120px]"');
    expect(mobileBagBlock).toContain("<IOSGroupedList");
    expect(mobileBagBlock).toContain("<IOSListRow");
    expect(mobileBagBlock).toContain("mobileBagMovementFilterHref");
    expect(mobileBagBlock).toContain('aria-current={isActive ? "page" : undefined}');
    expect(mobileBagBlock).not.toContain("<Table");
    expect(mobileBagBlock).not.toContain("min-w-[1120px]");
  });

  it("keeps connected goal and trend content free of nested Card shells", () => {
    const goal =
      source.match(/function GoalProgressPanel[\s\S]*?function WeeklyRecapPanel/)?.[0] ?? "";
    const trends =
      source.match(/function ProgressTrendsPanel[\s\S]*?function Sparkline/)?.[0] ?? "";

    expect(goal).toContain("<Item");
    expect((goal.match(/<Card(?:\s|>)/g) ?? []).length).toBe(1);
    expect(trends).toContain("<LazyMetricTrendCard");
    expect(trends).toContain("<section");
    expect(trends).not.toContain("<Card");
  });

  it("keeps technical readiness separate from real-round scoring confidence", () => {
    expect(source).toContain('label: "Technical readiness"');
    expect(source).toContain('label: "Scoring confidence"');
    expect(source).toContain("Technical profile");
    expect(source).toContain("This does not predict a score.");
    expect(source).toContain("comparable real");
    expect(source).toContain("not enough to connect range form to scoring");
    expect(source).not.toContain("Break 80 readiness");
    expect(source).not.toContain("Competition ready");
  });

  it("names current form and historical trust as separate club signals", () => {
    expect(source).toContain('<TabsTrigger value="performance">Performance</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="timeline">Timeline</TabsTrigger>');
    expect(source).toContain("summary.rankings.mostImproved");
    expect(source).toContain("summary.rankings.mostTrusted");
  });

  it("keeps the distance-loss diagnosis theme-safe outside its chart palette", () => {
    expect(diagnosisSource).toContain("var(--status-success-surface)");
    expect(diagnosisSource).toContain("var(--status-warning-surface)");
    expect(diagnosisSource).toContain("var(--status-information-surface)");
    expect(diagnosisSource).not.toMatch(
      /(?:bg|text|border)-(?:white|slate|emerald|green|amber|orange|red|rose|indigo|violet|purple)(?:-\d+|\/)/,
    );
    expect(diagnosisSource).toContain("className={buttonVariants");
    expect(diagnosisSource).not.toContain("<CollapsibleTrigger asChild>");
    expect(diagnosisSource).not.toContain("<CollapsibleContent asChild>");
  });
});
