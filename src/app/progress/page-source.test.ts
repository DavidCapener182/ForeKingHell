import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/progress/page.tsx"), "utf8");

describe("progress desktop workbench source", () => {
  it("keeps progress full width and practice split from crowding laptop workbenches", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";
    const practicePanelBlock =
      source.match(/function PracticePlanPanel[\s\S]*?function PracticePriorityFeatureCard/)?.[0] ??
      "";

    expect(layoutBlock).toContain('scope="progress"');
    expect(layoutBlock).not.toContain("DesktopInsightRail");
    expect(layoutBlock).not.toContain("rail={");
    expect(layoutBlock).not.toContain('railBreakpoint="wide"');

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
});
