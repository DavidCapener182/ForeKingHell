import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/stats/training-over-time/page.tsx"),
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

  it("keeps Practice Planner load fit visible without adding a dense rail", () => {
    expect(source).toContain("Practice Planner load fit");
    expect(source).toContain("practiceSummary.latestCompleted");
    expect(source).toContain("Completed plans");
    expect(source).toContain("Average score");
    expect(source).toContain("Recent Load");
  });
});
