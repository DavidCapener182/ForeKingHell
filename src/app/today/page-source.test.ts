import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/today/page.tsx"), "utf8");
const chartsSource = readFileSync(
  join(process.cwd(), "src/app/today/today-shot-charts.tsx"),
  "utf8",
);

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

  it("uses component-sized container layouts for desktop practice cards", () => {
    expect(source).toContain("today-practice-grid-has-prescription");
    expect(source).toContain('"prescription mode"');
    expect(source).toContain('"plan plan"');
    expect(source).not.toContain('grid-template-areas: "prescription mode plan"');
    expect(source).toContain("today-mode-header");
    expect(source).toContain("today-prescription-grid");
    expect(source).toContain("today-plan-grid");
    expect(source).toContain("today-coaching-grid");
    expect(source).not.toContain("today-practice-plan-wide");
    expect(source).not.toContain("today-practice-plan-rail");
  });

  it("keeps every paired desktop region on a shared row edge", () => {
    for (const row of [
      "today-top",
      "today-signal",
      "today-practice",
      "today-highlights",
      "today-highlight-cards",
      "today-footer",
    ]) {
      expect(source).toContain(`data-equal-height-row="${row}"`);
    }

    expect(source).toContain("today-top-grid grid items-stretch");
    expect(source).toContain("today-signal-grid grid items-stretch");
    expect(source).toContain("today-practice-grid grid items-stretch");
    expect(source).toContain("today-highlights-grid grid items-stretch");
    expect(source).toContain("auto-rows-fr items-stretch");
    expect(source).toContain("grid items-stretch gap-4 lg:grid-cols-2");
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

  it("separates practice usefulness from the planned drill and scoring control", () => {
    expect(source).toContain("Practice usefulness");
    expect(source).toContain("Scoring control");
    expect(source).toContain("Planned drill result");
    expect(source).toContain(
      '<ScoreMiniMetric label="Playable" value={score.playableRateLabel} />',
    );
    expect(source).toContain(
      "How useful the session was; scoring control and planned-drill result stay separate.",
    );
    expect(source).toContain("The session was useful. The planned drill was not fully proven.");
    expect(source).toContain("Best scoring read");
    expect(source).toContain("Most trusted long-term");
    expect(source).toContain('scoringControl.label === "Mixed"');
    expect(source).toContain('? "Productive"');
    expect(source).not.toContain('label: "Most reliable"');
  });

  it("keeps raw shot history while explaining clean-scoring exclusions", () => {
    expect(source).toContain("Data cleaning impact");
    expect(source).toContain("data.dataCleaning.excludedShotCount");
    expect(source).toContain("data.rawShots.map");
    expect(source).toContain("formatShotQualityLabel(shot)");
    expect(source).toContain("Plan partially matched");
    expect(source).toContain("Clean scoring used");
  });

  it("keeps session filtering reversible and honest about unavailable target offsets", () => {
    expect(source).toContain("parsePracticeReviewMode(first(params.evidence))");
    expect(source).toContain("TodayReviewControls");
    expect(source).toContain("Trusted shots");
    expect(source).toContain("All imported");
    expect(source).toContain("Simulate outlier exclusions");
    expect(source).toContain("no separate target offset was imported");
    expect(source).toContain("Provider rows normalised to the stored yard and mph schema");
    expect(source).toContain("reviewShots(data, reviewMode)");
    expect(source).toContain("reviewComparisons(data, reviewMode)");
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
    expect(source).toContain("!isEstimatedClubData(shot.clubDataEstType)");
  });

  it("rounds generated SVG coordinates so server and client chart paths hydrate identically", () => {
    expect(chartsSource).toContain("svgCoordinate(xScale(offlineYd))");
    expect(chartsSource).toContain("svgCoordinate(yScale(downrangeYd))");
    expect(chartsSource).toContain("Math.round(value * 1000) / 1000");
  });

  it("keeps decorative dispersion ellipses out of the accessibility tree", () => {
    expect(chartsSource).not.toContain('aria-label="Approximate 80 percent dispersion ellipse"');
    expect(chartsSource).not.toContain('aria-label="Approximate 50 percent dispersion ellipse"');
    expect(chartsSource.match(/<ellipse[\s\S]*?aria-hidden="true"/g)).toHaveLength(2);
  });
});
