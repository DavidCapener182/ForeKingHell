import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/training/TrainingLoadRangeView.tsx"),
  "utf8",
);
const chartSource = readFileSync(
  join(process.cwd(), "src/components/training/TrainingOverTimeChart.tsx"),
  "utf8",
);
const loadChartSource = readFileSync(
  join(process.cwd(), "src/components/training/TrainingLoadBars.tsx"),
  "utf8",
);
const statusCardSource = readFileSync(
  join(process.cwd(), "src/components/training/TrainingStatusCard.tsx"),
  "utf8",
);

function componentBody(name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const exportStart = source.indexOf(`export function ${name}`);
  const resolvedStart = Math.max(start, exportStart);
  const end = source.indexOf(`function ${nextName}`, resolvedStart + 1);
  expect(resolvedStart).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(resolvedStart);
  return source.slice(resolvedStart, end);
}

describe("TrainingLoadRangeView readiness experience", () => {
  it("puts the connected metrics, central chart and one recommendation first", () => {
    const experience = componentBody("TrainingLoadRangeView", "ReadinessRecommendation");

    expect(experience).toContain("<TrainingSummaryCards");
    expect(experience).toContain("<TrainingOverTimeChart");
    expect(experience).toContain("<ReadinessRecommendation");
    expect(experience).toContain("Fitness &amp; freshness");
    expect(experience).toContain("Your golf readiness trend");
    expect(experience).toContain("<ResponsiveDetailPanel");
    expect(experience).toContain("data-training-log-trigger");
    expect(experience).toContain("data-training-desktop-history");
    expect(experience.indexOf("<TrainingSummaryCards")).toBeLessThan(
      experience.indexOf("<TrainingOverTimeChart"),
    );
    expect(experience.indexOf("<TrainingOverTimeChart")).toBeLessThan(
      experience.indexOf("<TrainingRhythmWorkbench"),
    );
    expect(source.match(/<TrainingOverTimeChart/g)).toHaveLength(1);
    expect(source.match(/data-training-recommendation/g)).toHaveLength(1);

    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-export-table="training-load-sessions"');
    expect(source).toContain('mainTableLabel="Training load session table"');
    expect(source).toContain("trainingSessionSuggestedViews");
    expect(source).toContain("exportFileName={`forekinghell-training-load-${rangeKey}.csv`}");
    expect(source).toContain("No training load sessions are logged in this range.");

    expect(source).not.toContain("<ChartAccessibleFallback");
    expect(chartSource.match(/<ChartAccessibleFallback/g)).toHaveLength(1);
    expect(loadChartSource.match(/<ChartAccessibleFallback/g)).toHaveLength(1);
    expect(chartSource).toContain('{ key: "sessionQuality", label: "Session quality" }');
    expect(chartSource).toContain("Latest scored session quality");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).toContain("<ToggleGroup");
    expect(source).toContain("<ToggleGroupItem");
    expect(source).toContain('{ key: "4w", label: "4 weeks" }');
    expect(source).toContain('{ key: "3m", label: "3 months" }');
    expect(source).toContain('{ key: "6m", label: "6 months" }');
    expect(source).toContain('{ key: "1y", label: "1 year" }');
    const rangeControls = componentBody("RangeControls", "TrainingEmptyState");
    expect(rangeControls).not.toContain("<button");
    const chartLoading = componentBody("DeferredChartLoading", "TrainingLoadRangeView");
    expect(chartLoading).toContain("<Skeleton");
    expect(chartLoading).not.toContain(">Loading {label.toLowerCase()}…</div>");
  });

  it("keeps one golfer-facing decision and moves deeper history off mobile", () => {
    const recommendation = componentBody("ReadinessRecommendation", "TrainingRhythmWorkbench");
    const rhythm = componentBody("TrainingRhythmWorkbench", "GradeRow");

    expect(recommendation).toContain("buildReadinessRecommendation");
    expect(recommendation).toContain("Recommendation");
    expect(source).toContain('decision: "Push"');
    expect(source).toContain('decision: "Maintain"');
    expect(source).toContain('decision: "Technical only"');
    expect(source).toContain('decision: "Recovery"');
    expect(source).toContain("className={styles.desktopRanges}");
    expect(source).toContain("className={styles.desktopHistory}");
    expect(source).toContain("const isDesktopViewport = useDesktopViewport()");
    expect(source).toContain("{isDesktopViewport ? (");
    expect(source).not.toContain("RecoveryWorkbench");
    expect(source).not.toContain("buildNext48Plan");

    expect(rhythm.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(rhythm.match(/<CardContent/g)).toHaveLength(1);
    expect(rhythm).toContain('id="streak"');
    expect(rhythm).toContain('id="balance"');
    expect(rhythm).toContain("buildWeeklyTrainingScore");
    expect(rhythm).toContain("buildTrainingStreak");
    expect(rhythm).toContain("buildTrainingRatio");
    expect(rhythm).toContain("<Progress");

    for (const body of [recommendation, rhythm]) {
      expect(body).not.toContain("<DataPanel");
      expect(body).not.toContain("bg-white");
      expect(body).not.toContain("border-slate");
      expect(body).not.toContain("dark:");
    }
  });

  it("restores the coach interpretation and response metrics as flat semantic shadcn surfaces", () => {
    const efficiency = componentBody("EfficiencyCards", "TrainingSessionLedger");

    expect(source.match(/<TrainingStatusCard/g)).toHaveLength(1);
    expect(source.match(/<EfficiencyCards/g)).toHaveLength(1);
    expect(source).toContain("latest={displayData.latest}");
    expect(source).toContain("status={displayData.status}");
    expect(source).toContain("trend={displayData.trend}");
    expect(source).toContain("confidence={displayData.confidence}");
    expect(source).toContain("sessionFormSignal={displayData.sessionFormSignal}");
    expect(source).toContain("cards={displayData.efficiencyCards}");

    expect(statusCardSource).toContain("<DataPanel>");
    expect(statusCardSource).toContain("<SectionHeader");
    expect(statusCardSource).toContain("<CardContent");
    expect(statusCardSource).toContain("data-training-coach-summary");
    expect(statusCardSource).toContain("confidence.score");
    expect(statusCardSource).toContain("trend.detail");
    expect(statusCardSource).toContain("sessionFormSignal.detail");
    expect(statusCardSource.match(/<Card(?:\s|>)/g) ?? []).toHaveLength(0);

    expect(efficiency.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(efficiency.match(/<CardContent/g)).toHaveLength(1);
    expect(efficiency).toContain("cards.map");
    expect(efficiency).toContain("card.title");
    expect(efficiency).toContain("card.metric");
    expect(efficiency).toContain("card.detail");
    expect(efficiency).toContain("tone={card.tone}");
    expect(efficiency).toContain("divide-y divide-border");
    expect(efficiency).not.toContain("<DataPanel");
  });

  it("keeps the no-data guidance in one flat semantic alert", () => {
    const emptyState = componentBody("TrainingEmptyState", "buildWeeklyTrainingScore");

    expect(emptyState).toContain("<Alert");
    expect(emptyState).toContain("<AlertTitle");
    expect(emptyState).toContain("<AlertDescription");
    expect(emptyState).toContain("sm:divide-x");
    expect(emptyState).toContain("<Button asChild>");

    for (const nestedShell of [
      "<DataPanel",
      "<Card",
      "<CardContent",
      "<EmptyState",
      "<AppEmptyState",
      "<PrimerCard",
    ]) {
      expect(emptyState).not.toContain(nestedShell);
    }
    expect(source).not.toContain("function PrimerCard");
  });
});

describe("Training Load workbench bundle separation", () => {
  it("does not retain the obsolete phone mini-workbench or duplicate chart trees", () => {
    for (const legacy of [
      "MobileTrainingLoadRangeView",
      "IOSGroupedList",
      "IOSDisclosureGroup",
      "BottomSheet",
      'idPrefix="mobile-training-load"',
      'className="hidden lg:grid"',
      'className="hidden lg:block"',
      'className="hidden lg:contents"',
    ]) {
      expect(source).not.toContain(legacy);
    }
    expect(source).toContain('idPrefix="training-load"');
    expect(source.match(/<TrainingOverTimeChart/g)).toHaveLength(1);
    expect(source.match(/<TrainingLoadBars/g)).toHaveLength(1);
    expect(source.match(/<TrainingStatusCard/g)).toHaveLength(1);
    expect(source.match(/<EfficiencyCards/g)).toHaveLength(1);
    expect(source).not.toContain("<button");
  });

  it("uses semantic theme surfaces instead of fixed light-only tokens", () => {
    for (const fixedToken of [
      "bg-white",
      "bg-slate-",
      "border-slate-",
      "text-slate-",
      "bg-emerald-",
      "border-emerald-",
      "text-emerald-",
      "bg-sky-",
      "border-sky-",
      "text-sky-",
      "bg-amber-",
      "border-amber-",
      "text-amber-",
      "dark:",
    ]) {
      expect(source).not.toContain(fixedToken);
      expect(statusCardSource).not.toContain(fixedToken);
    }
    expect(source).toContain("--status-success-surface");
    expect(source).toContain("--status-warning-surface");
    expect(source).toContain("--status-information-surface");
    expect(source).toContain("--status-error-surface");
  });
});
