import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/stats/training-over-time/page.tsx"),
  "utf8",
);

describe("training load page source", () => {
  it("keeps Training Load as a focused desktop analytics workbench", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('scope="training-load"');
    expect(source).toContain("TrainingLoadRangeView");
    expect(source).toContain("A golf-specific view of fitness, freshness");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("max-w-6xl");
    expect(source).not.toContain("max-w-7xl");
  });

  it("keeps the desktop-only route free of an obsolete companion render tree", () => {
    expect(source).not.toContain("MobileTrainingLoadRangeView");
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain("MobileRouteHeader");
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).toContain('<DesktopWorkbenchLayout scope="training-load">');
  });

  it("does not place secondary planner or duplicate warning cards ahead of readiness", () => {
    expect(source).not.toContain("TrainingPracticePlannerPanel");
    expect(source).not.toContain("getPracticePlannerProgressSummary");
    expect(source).not.toContain("data-training-load-warning");
  });

  it("puts one chart and recommendation ahead of desktop-only supporting evidence", () => {
    const rangeSource = readFileSync(
      join(process.cwd(), "src/components/training/TrainingLoadRangeView.tsx"),
      "utf8",
    );
    const desktopRange = rangeSource.slice(
      rangeSource.indexOf("export function TrainingLoadRangeView"),
    );

    expect(desktopRange).toContain("<TrainingSummaryCards");
    expect(desktopRange).toContain("<TrainingOverTimeChart");
    expect(desktopRange).toContain("<ReadinessRecommendation");
    expect(desktopRange).toContain("<TrainingRhythmWorkbench");
    expect(desktopRange).toContain("<TrainingLoadBars");
    expect(desktopRange).toContain("<TrainingSessionLedger");
    expect(desktopRange).toContain("DesktopTableWorkbenchControls");
    expect(desktopRange).toContain("<TrainingStatusCard");
    expect(desktopRange).toContain("<EfficiencyCards");
    expect(desktopRange).toContain("<ResponsiveDetailPanel");
    expect(desktopRange).toContain("<RecentTrainingSessions");
    expect(desktopRange).toContain("data-training-load-actions");
    expect(desktopRange).toContain("data-training-desktop-history");
    expect(desktopRange).not.toContain("<MobileSectionChips");
    expect(desktopRange).not.toContain("MobileTrainingLoadRangeView");
    expect(desktopRange.match(/<TrainingOverTimeChart/g)).toHaveLength(1);
    expect(desktopRange.match(/<TrainingLoadBars/g)).toHaveLength(1);
    expect(desktopRange.match(/<TrainingStatusCard/g)).toHaveLength(1);
    expect(desktopRange.match(/<EfficiencyCards/g)).toHaveLength(1);
  });
});
