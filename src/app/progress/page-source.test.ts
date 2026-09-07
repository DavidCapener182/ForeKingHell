import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/progress/page.tsx"), "utf8");
const tabsSource = readFileSync(join(process.cwd(), "src/app/progress/progress-tabs.tsx"), "utf8");
const navigation = readFileSync(
  join(process.cwd(), "src/app/progress/progress-navigation.ts"),
  "utf8",
);
const history = readFileSync(
  join(process.cwd(), "src/app/progress/progress-load-history.tsx"),
  "utf8",
);
const loadChartSource = readFileSync(
  join(process.cwd(), "src/components/progress/progress-training-load-chart.tsx"),
  "utf8",
);

describe("progress direction story source", () => {
  it("uses the requested four-part story instead of the retired analytics wall", () => {
    expect(source).toContain("<ProgressTabs");
    expect(tabsSource).toContain('label="Progress sections"');
    for (const tab of ["performance", "goals", "load", "timeline"]) {
      expect(navigation).toContain(`value: "${tab}"`);
      expect(source).toContain(`${tab}:`);
    }
    expect(tabsSource).toMatch(/content:\s*panels\[tab\.value\]/);
    expect(source).not.toContain("DesktopInsightRail");
  });

  it("leads Performance with one score, useful-period movement, confidence and why", () => {
    expect(source).toContain("data-performance-story");
    expect(source).toContain(
      "<ProgressSnapshot score={score} cleanShots={summary.totals.trackedCleanShots} />",
    );
    expect(source).toContain("progressConfidence(summary, scoringEvidence)");
    expect(source).toContain("<ProgressComparison clubs={comparisons} />");
    expect(source).toContain("<WeeklyEvidenceStrip");
    expect(source).toContain("{confidence.detail}");
  });

  it("turns the strongest improvement and main blocker into exactly two editorial calls", () => {
    const editorial =
      source.match(/data-performance-editorial-calls[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(editorial.match(/<EditorialCallout\b/g)).toHaveLength(2);
    expect(editorial).toContain('eyebrow="Club evidence to review"');
    expect(editorial).toContain('eyebrow="Main blocker"');
    expect(source).toContain("progressRecommendation(summary)");
    expect(source).toContain("blocker.reason");
    expect(source).toContain("blocker?.evidence");
  });

  it("shows all saved goals with current values and evidence limitations", () => {
    expect(source).toContain("const activeGoals = preferences.goals");
    expect(source).toContain("automatically verified against a new session.");
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
    expect(history).toContain("selectTrainingRangeData(data, range)");
    expect(source).toContain("<ProgressLoadHistory data={data} />");
    expect(history).toContain("<ProgressTrainingLoadChart");
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
    expect(source).toContain("<TimelineStory items={timeline} />");
    for (const category of ["Practice", "Round", "PB", "Goal change", "Bag change", "Confidence"]) {
      expect(source).toContain(`"${category}"`);
    }
    expect(source).toContain("for (const session of trainingData.sessions)");
    expect(source).toContain("summary.journey");
    expect(source).toContain("equipmentSnapshots");
    expect(source).toContain("Change date unavailable");
    expect(source).toContain("a goal-specific change history is not recorded");
  });

  it("keeps the route full-width and serves a dedicated companion story beside the workbench", () => {
    expect(source).toContain("data-progress-surface={surface}");
    expect(source).toContain("min-w-0");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    expect(source).toContain('if (surface === "companion")');
    expect(source).not.toContain("IOSDisclosureGroup");
  });

  it("keeps tab selection URL-backed in the shared responsive control", () => {
    expect(tabsSource).toContain('className="min-w-0"');
    expect(tabsSource).toContain("<UntitledTabs");
    expect(tabsSource).toContain("items={progressTabs.map((tab)");
    expect(tabsSource).toContain('selectedKey={progressTab(query.get("tab"))}');
    expect(tabsSource).toContain("progressTabUrl(window.location.href, progressTab(key))");
    expect(tabsSource).not.toContain("min-w-max");
  });
});
