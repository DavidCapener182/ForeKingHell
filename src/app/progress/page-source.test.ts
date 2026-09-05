import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/progress/page.tsx"), "utf8");
const loadChartSource = readFileSync(
  join(process.cwd(), "src/components/progress/progress-training-load-chart.tsx"),
  "utf8",
);

describe("progress direction story source", () => {
  it("uses the requested four-part story instead of the retired analytics wall", () => {
    expect(source).toContain('aria-label="Progress story"');
    for (const tab of ["performance", "goals", "load", "timeline"]) {
      expect(source).toContain(`value="${tab}"`);
    }
    expect(source).toMatch(/<TabsTrigger[^>]*value="performance"[\s\S]*?>\s*Performance\s*</);
    expect(source).toMatch(/<TabsTrigger[^>]*value="goals"[\s\S]*?>\s*Goals\s*</);
    expect(source).toMatch(/<TabsTrigger[^>]*value="load"[\s\S]*?>\s*Load\s*</);
    expect(source).toMatch(/<TabsTrigger[^>]*value="timeline"[\s\S]*?>\s*Timeline\s*</);

    for (const retired of [
      "WeeklyRecapPanel",
      "ProgressRoadmapPanel",
      "ProgressTrendsPanel",
      "BagMovementPanel",
      "CoachTimelinePanel",
      "DesktopInsightRail",
      "ConnectedMetricBar",
      "DistanceLossDiagnosisPanel",
    ]) {
      expect(source).not.toContain(retired);
    }
  });

  it("leads Performance with one score, useful-period movement, confidence and why", () => {
    expect(source).toContain("data-performance-story");
    expect(source).toContain("Progress score / 100");
    expect(source).toContain("from first clean baseline");
    expect(source).toContain("Why it moved");
    expect(source).toContain("progressConfidence(summary, scoringEvidence)");
    expect(source).toContain("data-performance-primary-trend");
    expect(source).toContain("No forecast is added.");
    expect(source).not.toMatch(/\bGauge\b/);
  });

  it("turns the strongest improvement and main blocker into exactly two editorial calls", () => {
    const editorial =
      source.match(/data-performance-editorial-calls[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(editorial.match(/<EditorialCallout\b/g)).toHaveLength(2);
    expect(editorial).toContain('eyebrow="Strongest improvement"');
    expect(editorial).toContain('eyebrow="Main blocker"');
    expect(source).toContain("diagnosis.headline");
    expect(source).toContain("diagnosis.summary");
  });

  it("shows no more than four real saved goals with the required horizontal treatment", () => {
    expect(source).toContain("preferences.goals.slice(0, 4)");
    expect(source).toContain("goalProgress(goal)");
    for (const label of ["Current", "Target", "Deadline"]) {
      expect(source).toContain(`label="${label}"`);
    }
    expect(source).toContain(">Progress</span>");
    expect(source).toContain("goal.nextAction");
    expect(source).toContain('className="h-4"');
  });

  it("embeds the important Training Load chart without duplicating its full workbench", () => {
    expect(source).toContain('getTrainingOverTimeData(userId, "1y")');
    expect(source).toContain('selectTrainingRangeData(trainingData, "3m")');
    expect(source).toContain("<ProgressTrainingLoadChart");
    expect(source).toContain("Golf Form");
    expect(source).toContain("Training Fitness");
    expect(source).toContain("Recent Load");
    expect(source).toContain("Open full Training Load");
    expect(source).not.toContain("<TrainingLoadRangeView");
    expect(source).not.toContain("TrainingSessionLedger");
    expect(source).not.toContain("TrainingSourceSuggestions");

    expect(loadChartSource).toContain('"use client"');
    expect(loadChartSource).toContain('import("@/components/training/TrainingOverTimeChart")');
    expect(loadChartSource).not.toContain('from "recharts"');
  });

  it("builds one chronology from practice, rounds, PBs, goals, bag changes and confidence", () => {
    expect(source).toContain("data-progress-timeline-story");
    for (const category of ["Practice", "Round", "PB", "Goal change", "Bag change", "Confidence"]) {
      expect(source).toContain(`"${category}"`);
    }
    expect(source).toContain("trainingData.sessions.slice(0, 8)");
    expect(source).toContain("summary.journey");
    expect(source).toContain("equipmentSnapshots");
    expect(source).toContain("goalPlanUpdatedAt");
  });

  it("keeps the route full-width and serves a dedicated companion story beside the workbench", () => {
    expect(source).toContain("data-progress-surface={surface}");
    expect(source).toContain("min-w-0");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    expect(source).toContain('if (surface === "companion")');
    expect(source).not.toContain("IOSDisclosureGroup");
  });

  it("fits all four story tabs within a phone viewport", () => {
    const tabs = source.slice(
      source.indexOf('aria-label="Progress story"'),
      source.indexOf("</TabsList>"),
    );

    expect(tabs).toMatch(/className="[^"]*grid[^"]*w-full[^"]*min-w-0[^"]*grid-cols-4/);
    expect(tabs).toContain("min-w-0");
    expect(tabs).not.toContain("min-w-max");
    expect(tabs).not.toMatch(/min-w-(?:20|24|28)/);
    expect(tabs).toContain("sm:w-fit");
  });
});
