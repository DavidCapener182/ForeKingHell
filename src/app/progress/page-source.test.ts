import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/progress/page.tsx"), "utf8");

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
    const practicePanelBlock =
      source.match(/function PracticePlanPanel[\s\S]*?function PracticePriorityFeatureCard/)?.[0] ??
      "";

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

    expect(practicePanelBlock).toContain(
      "min-[2400px]:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]",
    );
    expect(practicePanelBlock).not.toContain(
      "xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]",
    );
  });

  it("adds saved views, column control and export to the progress bag movement table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("progressBagMovementSavedViews");
    expect(source).toContain('viewKey="progress-bag-movement"');
    expect(source).toContain('scope="progress-bag-movement"');
    expect(source).toContain('data-workbench-scope="progress-bag-movement"');
    expect(source).toContain('exportTableId="progress-bag-movement"');
    expect(source).toContain('data-workbench-export-table="progress-bag-movement"');
    expect(source).toContain('mainTableLabel="Progress bag movement table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["club", "trust", "clean-shots", "stock-carry", "movement"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the progress trend chart explainable with a text summary and data-table fallback", () => {
    const trendsBlock =
      source.match(/function ProgressTrendsPanel[\s\S]*?function TrendCard/)?.[0] ?? "";

    expect(trendsBlock).toContain("ChartAccessibleFallback");
    expect(trendsBlock).toContain('title="Progress trends"');
    expect(trendsBlock).toContain("summary={progressTrendChartSummary(summary.trends)}");
    expect(trendsBlock).toContain("rows={trendRows}");
    expect(trendsBlock).toContain('{ key: "trend", label: "Trend" }');
    expect(trendsBlock).toContain('{ key: "readout", label: "Readout" }');
  });

  it("consolidates the desktop bento wall into four focused workbench tabs", () => {
    expect(source).toContain("data-progress-workspace");
    expect(source).toContain('aria-label="Progress workspace"');
    for (const tab of ["performance", "goals", "load", "timeline"]) {
      expect(source).toContain(`value="${tab}"`);
    }
    expect(source).toContain("<PracticePlanPanel priorities={summary.practicePlan} />");
    expect(source).toContain("<CoachReadoutPanel");
    expect(source).toContain("<PracticeCalendarPanel calendar={featureData.practiceCalendar} />");
    expect(source).toContain("<TrustLadderPanel items={summary.trustLadder} />");
    expect(source).toContain(
      "<BagMovementPanel rows={summary.clubRows} activeFilter={bagFilter} />",
    );
    expect(source).toContain('<div id="journey" className="scroll-mt-28">');
    expect(source).not.toContain("data-progress-bento-item");
  });

  it("gives mobile one answer-first progress readout before any supporting disclosure", () => {
    const mobileComposition =
      source.match(
        /<div className="grid min-w-0 gap-4 lg:hidden">[\s\S]*?<div className="hidden lg:contents">/,
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
    expect(source).toContain('aria-label="Overall progress score"');
    expect(source).not.toContain("<MobileTabBar");
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

  it("keeps the analytical desktop workbench while replacing its wide bag table on mobile", () => {
    const mobileBagBlock =
      source.match(/function MobileBagMovement[\s\S]*?function MobileProgressJourney/)?.[0] ?? "";

    expect(source).toContain('className="hidden lg:contents"');
    expect(source).toContain('data-workbench-export-table="progress-bag-movement"');
    expect(source).toContain('className="min-w-[1120px]"');
    expect(mobileBagBlock).toContain("<IOSGroupedList");
    expect(mobileBagBlock).toContain("<IOSListRow");
    expect(mobileBagBlock).toContain("mobileBagMovementFilterHref");
    expect(mobileBagBlock).toContain('aria-current={isActive ? "page" : undefined}');
    expect(mobileBagBlock).not.toContain("<Table");
    expect(mobileBagBlock).not.toContain("min-w-[1120px]");
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
});
