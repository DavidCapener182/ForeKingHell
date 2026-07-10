import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/progress/page.tsx"), "utf8");
const globalStyles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("progress desktop workbench source", () => {
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
    expect(layoutBlock).toContain("progressInsightMetrics(summary)");
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

  it("uses an independent progress main column and supporting rail instead of forced-height peers", () => {
    expect(source).toContain(
      'className="progress-analysis-grid grid min-w-0 items-stretch gap-4 lg:gap-5"',
    );
    expect(source).toContain(
      'className="progress-main-rail grid min-w-0 items-stretch gap-4 lg:gap-5"',
    );
    expect(source).toContain(
      'className="progress-supporting-rail grid h-full min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 lg:gap-5"',
    );
    expect(source).toContain("<PracticePlanPanel priorities={summary.practicePlan} />");
    expect(source).toContain("<CoachReadoutPanel");
    expect(source).toContain("<PracticeCalendarPanel calendar={featureData.practiceCalendar} />");
    expect(source).toContain("<TrustLadderPanel items={summary.trustLadder} />");
    expect(source).toContain('<DataPanel stretch className="h-full">');
    expect(source).toContain('<CardContent className="grid flex-1 content-between gap-2">');
    expect(source).toContain(
      "<BagMovementPanel rows={summary.clubRows} activeFilter={bagFilter} />",
    );
    expect(source).toContain('<div id="journey" className="scroll-mt-28">');

    const bentoCss =
      globalStyles.match(
        /@media \(min-width: 1024px\) \{[\s\S]*?\.mobile-nav-primary-active/,
      )?.[0] ?? "";
    expect(bentoCss).toContain("align-items: start");
    expect(bentoCss).not.toContain(".progress-bento-item > *");
    expect(bentoCss).toContain(".progress-analysis-grid");
    expect(bentoCss).toContain(".progress-main-rail");
  });

  it("separates mobile progress dimensions without rewarding volume as improvement", () => {
    expect(source).toContain("MobileProgressDimensions");
    for (const label of [
      "Performance",
      "Consistency",
      "Strike quality",
      "Direction control",
      "Speed",
      "Training volume",
      "Confidence / sample",
    ]) {
      expect(source).toContain(`label: "${label}"`);
    }
    expect(source).toContain("more shots is not automatic improvement");
  });
});
