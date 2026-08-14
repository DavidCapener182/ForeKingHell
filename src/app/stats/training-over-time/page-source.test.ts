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
    expect(source).toContain("TrainingPracticePlannerPanel");
    expect(source).not.toContain("DesktopInsightRail");
  });

  it("keeps the desktop-only route free of an obsolete companion render tree", () => {
    expect(source).not.toContain("MobileTrainingLoadRangeView");
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain("MobileRouteHeader");
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).toContain('<DesktopWorkbenchLayout scope="training-load">');
  });

  it("keeps Practice Planner load fit visible without adding a dense rail", () => {
    expect(source).toContain("Practice Planner load fit");
    expect(source).toContain("practiceSummary.latestCompleted");
    expect(source).toContain("Completed plans");
    expect(source).toContain("Average score");
    expect(source).toContain("Recent Load");
    expect(source).toContain("<ConnectedMetricBar");
    expect(source).toContain("data-training-load-warning");
    expect(source).toContain("data-training-practice-recommendation");
  });

  it("keeps the primary chart concise without deleting the desktop evidence workbench", () => {
    const rangeSource = readFileSync(
      join(process.cwd(), "src/components/training/TrainingLoadRangeView.tsx"),
      "utf8",
    );
    const desktopRange = rangeSource.slice(
      rangeSource.indexOf("export function TrainingLoadRangeView"),
    );

    expect(desktopRange).toContain("<TrainingSummaryCards");
    expect(desktopRange).toContain("<TrainingOverTimeChart");
    expect(desktopRange).toContain("<RecoveryWorkbench");
    expect(desktopRange).toContain("<TrainingRhythmWorkbench");
    expect(desktopRange).toContain("<TrainingLoadBars");
    expect(desktopRange).toContain("<TrainingSessionLedger");
    expect(desktopRange).toContain("DesktopTableWorkbenchControls");
    expect(desktopRange).toContain("<TrainingStatusCard");
    expect(desktopRange).toContain("<EfficiencyCards");
    expect(desktopRange).toContain("<TrainingSourceSuggestions");
    expect(desktopRange).toContain("<ResponsiveDetailPanel");
    expect(desktopRange).toContain("<RecentTrainingSessions");
    expect(desktopRange).toContain("data-training-load-actions");
    expect(desktopRange).not.toContain("<MobileSectionChips");
    expect(desktopRange).not.toContain("MobileTrainingLoadRangeView");
    expect(desktopRange.match(/<TrainingOverTimeChart/g)).toHaveLength(1);
    expect(desktopRange.match(/<TrainingLoadBars/g)).toHaveLength(1);
    expect(desktopRange.match(/<TrainingStatusCard/g)).toHaveLength(1);
    expect(desktopRange.match(/<EfficiencyCards/g)).toHaveLength(1);
  });
});
