import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/today/page.tsx"), "utf8");

describe("latest practice desktop dashboard", () => {
  it("uses the optional desktop AI rail for latest practice evidence", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('scope="today"');
    expect(source).toContain("DesktopInsightRail");
    expect(source).toContain('title="AI latest-practice rail"');
    expect(source).toContain('railBreakpoint="wide"');
    expect(source).toContain("todayInsightMetrics(data, linkedPracticePlan)");
    expect(source).toContain("todayInsightEvidence(data, linkedPracticePlan)");
    expect(source).toContain('commonAiPrompts("latest practice review")');
    expect(source).toContain('label: "Open shot rows"');
    expect(source).toContain('label: "Open planner"');
  });

  it("does not split compact practice cards until very wide screens", () => {
    expect(source).toContain("min-[1900px]:grid-cols-2");
    expect(source).toContain("min-[1900px]:flex-row");
    expect(source).not.toContain("2xl:flex-row");
    expect(source).toContain("md:grid-cols-2 2xl:grid-cols-3");
    expect(source).not.toContain("md:grid-cols-2 xl:grid-cols-3");
  });

  it("keeps embedded latest-practice tables captioned and keyboardable", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("todayClubPerformanceColumns");
    expect(source).toContain("todayRawShotColumns");
    expect(source).toContain("todaySavedViews");
    expect(source).toContain("TableCaption");
    expect(source).toContain("mainTable");
    expect(source).toContain('label="Club performance comparison table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('data-workbench-scope="today-club-performance"');
    expect(source).toContain('data-workbench-export-table="today-club-performance"');
    expect(source).toContain('exportFileName="forekinghell-latest-practice-club-performance.csv"');
    expect(source).toContain('aria-describedby="today-club-performance-summary"');
    expect(source).toContain('id="today-club-performance-summary"');
    expect(source).toContain('label="Raw shot preview table"');
    expect(source).toContain('data-workbench-scope="today-raw-shot-preview"');
    expect(source).toContain('data-workbench-export-table="today-raw-shot-preview"');
    expect(source).toContain('exportFileName="forekinghell-latest-practice-raw-shots.csv"');
    expect(source).toContain('aria-describedby="today-raw-shot-preview-summary"');
    expect(source).toContain('id="today-raw-shot-preview-summary"');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");
    expect(source).toContain("sticky left-0 z-20");

    for (const column of [
      "club",
      "call",
      "shots",
      "carry",
      "offline",
      "straight",
      "playable",
      "signal",
      "session",
      "shot",
      "type",
      "quality",
      "start",
      "ball",
      "smash",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("loads social challenge context only when latest practice asks for it", () => {
    expect(source).toContain("type TodaySocialContext");
    expect(source).toContain("shouldLoadTodaySocial(first(params.social))");
    expect(source).toContain("socialLoaded ? getChallengesPageData() : Promise.resolve(null)");
    expect(source).toContain("const socialContext: TodaySocialContext");
    expect(source).toContain("socialContext={socialContext}");
    expect(source).toContain("todaySocialHref(data, clubSort)");
    expect(source).toContain('social: "1"');
    expect(source).toContain('id="social-context"');
    expect(source).toContain("socialContext.loaded");
    expect(source).toContain("Social comparison is on demand");
    expect(source).toContain("Load challenge context");
  });

  it("separates session quality from plan result and scoring control", () => {
    expect(source).toContain("Session quality");
    expect(source).toContain("Scoring control");
    expect(source).toContain("Plan result");
    expect(source).toContain(
      '<ScoreMiniMetric label="Playable" value={score.playableRateLabel} />',
    );
    expect(source).toContain("Quality, strike, scoring control and plan result separated.");
    expect(source).toContain("The plan result is incomplete, but the session itself was not poor.");
  });

  it("keeps raw shot history while explaining clean-scoring exclusions", () => {
    expect(source).toContain("Data cleaning impact");
    expect(source).toContain("data.dataCleaning.excludedShotCount");
    expect(source).toContain("data.rawShots.map");
    expect(source).toContain("formatShotQualityLabel(shot)");
    expect(source).toContain("Plan partially matched");
    expect(source).toContain("Clean scoring used");
  });

  it("uses scoring-trust language instead of generic confidence copy", () => {
    expect(source).toContain("Scoring trust");
    expect(source).toContain("Monitor start line");
    expect(source).toContain("Tighten start line");
    expect(source).not.toContain("Which clubs can you trust?");
  });

  it("keeps driver delivery and club badges golfer-facing", () => {
    expect(source).toContain("Driver delivery");
    expect(source).toContain("Playable, monitor path");
    expect(source).toContain("Path is below the draw-window target");
    expect(source).toContain("clubSessionBadgeReadout(comparison.clubType, comparison.today)");
    expect(source).not.toContain("Path outside normal range");
    expect(source).not.toContain("Current path is outside the normal draw window");
  });
});
