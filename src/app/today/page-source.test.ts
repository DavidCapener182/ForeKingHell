import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/today/today-workbench-page.tsx"),
  "utf8",
);
const routeSource = readFileSync(join(process.cwd(), "src/app/(app)/today/page.tsx"), "utf8");
const companionSource = readFileSync(
  join(process.cwd(), "src/app/(app)/today/today-companion-page.tsx"),
  "utf8",
);
const primaryAnswerSource = readFileSync(
  join(process.cwd(), "src/components/app/today-primary-answer.tsx"),
  "utf8",
);
const loadingSource = readFileSync(join(process.cwd(), "src/app/(app)/today/loading.tsx"), "utf8");
const chartsSource = readFileSync(
  join(process.cwd(), "src/app/today/today-shot-charts.tsx"),
  "utf8",
);

describe("latest practice desktop dashboard", () => {
  it("branches before importing the focused companion or full workbench", () => {
    expect(routeSource).toContain('surface === "companion"');
    expect(routeSource).toContain('await import("./today-companion-page")');
    expect(routeSource).toContain('await import("./today-workbench-page")');
    expect(companionSource).toContain("data-today-companion");
    expect(companionSource).toContain("TodayPrimaryAnswer");
    expect(primaryAnswerSource).toContain("data-primary-recommendation");
    expect(primaryAnswerSource).toContain("data-today-sync-state");
    expect(primaryAnswerSource).toContain("<Progress");
    expect(primaryAnswerSource).toContain('new Event("fkh-offline-retry-requested")');
    expect(loadingSource).toContain("Loading Today answer");
    expect(loadingSource).toContain("Loading latest shot pattern");
    expect(loadingSource.match(/role="status"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(loadingSource.match(/aria-busy="true"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(loadingSource).toContain("aspect-[82/43]");
    expect(primaryAnswerSource).toContain("Retry sync");
    expect(primaryAnswerSource).toContain("<ButtonGroup");
    expect(primaryAnswerSource).toContain("<DropdownMenu");
    expect(companionSource).toContain("Plan range session");
    expect(companionSource).toContain("Why this recommendation?");
    expect(companionSource).toContain('href="/quick-bag"');
    expect(companionSource).not.toContain("TodayShotCharts");
    expect(companionSource).not.toContain("TodayMobileEvidence");
    expect(companionSource).not.toContain("getChallengesPageData");
  });

  it("keeps companion and iOS rendering out of the workbench bundle", () => {
    for (const legacyMobileSymbol of [
      "MobileAppShell",
      "MobileTopBar",
      "MobileFilterSheet",
      "MobileHorizontalRail",
      "MobileDataCard",
      "IOSDisclosureGroup",
      "IOSGroupedList",
      "IOSInlineStatus",
      "IOSListRow",
      "IOSMetricRow",
      "IOSSectionHeader",
      "TodayMobile",
    ]) {
      expect(source).not.toContain(legacyMobileSymbol);
    }

    expect(source).not.toContain("@/components/app/ios-mobile");
    expect(source).not.toContain("@/components/mobile-sports");
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).toContain("data-desktop-today-workspace");
  });

  it("renders server-authored collapsible triggers directly across the RSC boundary", () => {
    expect(source).toContain('import { Button, buttonVariants } from "@/components/ui/button"');
    expect(source.match(/<CollapsibleTrigger\s+type="button"/g)).toHaveLength(2);
    expect(source.match(/className=\{buttonVariants\(\{/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source).not.toMatch(/<CollapsibleTrigger\s+asChild>[\s\S]*?<Button/);
  });

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

  it("uses a shadcn tab workspace to separate the desktop review modes", () => {
    expect(source).toContain("data-desktop-today-tabs");
    expect(source).toContain("data-today-hero-score-stack");
    expect(source).toContain("<Tabs");
    expect(source).toContain("<TabsList");
    expect(source).toContain('<TabsTrigger value="overview">Overview</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="practice">Practice</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="evidence">Evidence</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="data-quality">Data quality</TabsTrigger>');
    expect(source).toContain("<ConnectedMetricBar");
    expect(source).toContain("todayConnectedMetrics(data, linkedPracticePlan)");
    expect(source).not.toContain("TodayBentoItem");
  });

  it("keeps the focused practice workflow available inside its desktop tab", () => {
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

  it("keeps the focused paired regions aligned within their tabs", () => {
    for (const row of ["today-signal", "today-practice"]) {
      expect(source).toContain(`data-equal-height-row="${row}"`);
    }

    expect(source).toContain("today-signal-grid grid items-stretch");
    expect(source).toContain("today-practice-grid grid items-stretch");
    expect(source).toContain("grid items-start gap-5 xl:grid-cols-2");
  });

  it("keeps Shot of the day in the verdict hero without a duplicate evidence panel", () => {
    expect(source).toContain("<HeroShotSpotlight");
    expect(source).toContain("Shot of the day");
    expect(source).not.toContain("<TodayHighlightsPanel");
    expect(source).not.toContain("function TodayHighlightsPanel");
    expect(source).not.toContain("function StraightShotCard");
    expect(source).not.toContain("function StraightShotMetric");
    expect(source).not.toContain("Latest practice highlights");
    expect(source).not.toContain("today-highlights-rail");
    expect(source).not.toContain("border-sky-200 bg-sky-50/70");
    expect(source).not.toContain("border-slate-200/80 bg-white");
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
      '<ScoreMiniMetric label="Lateral window" value={score.playableRateLabel} />',
    );
    expect(source).toContain(
      "How useful the session was; scoring control and planned-drill result stay separate.",
    );
    expect(source).toContain("The session was useful. The planned drill was not fully proven.");
    expect(source).toContain("Best current form");
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

  it("keeps desktop evidence filtering reversible", () => {
    expect(source).toContain("parsePracticeReviewMode(first(params.evidence))");
    expect(source).toContain("TodayDesktopFilterBar");
    expect(source).toContain("<DataToolbar");
    expect(source).toContain("<ToggleGroup");
    expect(source).toContain("Trusted shots");
    expect(source).toContain("All imported");
    expect(source).toContain("Simulate outlier exclusions");
    expect(source).toContain("todayReviewModeHref(data, clubSort");
    expect(source).toContain("reviewShots(data, reviewMode)");
    expect(source).toContain("reviewComparisons(data, reviewMode)");
    expect(source).not.toContain("TodayReviewControls");
  });

  it("uses theme tokens across ordinary workbench surfaces while preserving golf visuals", () => {
    const ordinaryThemeBlocks = [
      source.slice(
        source.indexOf("function TodayDesktopFilterBar"),
        source.indexOf("function TodayHoverStyles"),
      ),
      source.slice(
        source.indexOf("function TodayHoverStyles"),
        source.indexOf("function TodayVerdictHero"),
      ),
      source.slice(
        source.indexOf("function TodayVerdictHero"),
        source.indexOf("function HeroShotSpotlight"),
      ),
      source.slice(
        source.indexOf("function TodayPracticePrescription"),
        source.indexOf("function TodaySocialLine"),
      ),
      source.slice(
        source.indexOf("function reviewIconClass"),
        source.indexOf("function deltaText"),
      ),
    ];
    const fixedPaletteClass =
      /(?:bg|text|border)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border)-\[#|bg-\[linear-gradient|rgba\(/;

    for (const block of ordinaryThemeBlocks) {
      expect(block).not.toMatch(fixedPaletteClass);
    }

    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-information-surface)");
    expect(source).toContain("var(--status-error-surface)");
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-muted");
    expect(source).not.toMatch(/<button\b/);

    const shotOfDayVisual = source.slice(
      source.indexOf("function HeroShotSpotlight"),
      source.indexOf("function TodayPracticePrescription"),
    );
    expect(shotOfDayVisual).toContain("bg-[#083524]");
    expect(shotOfDayVisual).toContain("bg-emerald-950");
    expect(chartsSource).toContain('driver: "#2563eb"');
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

  it("uses semantic shadcn filters and summary chrome around the preserved chart palette", () => {
    const controls = chartsSource.slice(
      chartsSource.indexOf("export function TodayShotCharts"),
      chartsSource.indexOf("function ChartPanel"),
    );
    const summaries = chartsSource.slice(
      chartsSource.indexOf("function DispersionCorridorStats"),
      chartsSource.indexOf("function DispersionChart"),
    );

    expect(controls).toContain("<Alert");
    expect(controls).toContain("<ToggleGroup");
    expect(controls).toContain("<ToggleGroupItem");
    expect(controls).toContain("<Button");
    expect(controls).not.toMatch(/<button\b/);
    expect(controls).toContain("var(--status-success-surface)");
    expect(summaries).toContain("border-border bg-card");
    expect(summaries).toContain("text-foreground");
    expect(summaries).not.toMatch(/border-slate|bg-white|text-slate|bg-emerald|text-emerald/);
    expect(chartsSource).toContain("var(--status-error-surface)");
    expect(chartsSource).toContain("var(--status-information-surface)");
    expect(chartsSource).toContain("var(--status-warning-surface)");
    expect(chartsSource).not.toMatch(/<button\b/);

    expect(chartsSource).toContain('driver: "#2563eb"');
    expect(chartsSource).toContain('fill="white"');
    expect(chartsSource).toContain('stroke="#e5e7eb"');
  });

  it("keeps status-surface labels fully opaque with explicit semantic foregrounds", () => {
    expect(source).not.toContain("opacity-75");
    expect(source).toContain("function reviewLabelClass(tone: ReviewTone)");
    expect(source).toContain('if (tone === "pink") return "text-destructive"');
    expect(source).toContain(
      'if (tone === "amber") return "text-[var(--status-warning-foreground)]"',
    );
    expect(source).toContain(
      'if (tone === "sky") return "text-[var(--status-information-foreground)]"',
    );
  });

  it("keeps compact corridor ranges fully opaque on every semantic status surface", () => {
    const corridorStats = chartsSource.slice(
      chartsSource.indexOf("function DispersionCorridorStats"),
      chartsSource.indexOf("function DispersionMarkerLegend"),
    );

    expect(corridorStats).toContain("corridorRangeClass(bucket.tone)");
    expect(corridorStats).not.toContain("opacity-70");
    expect(chartsSource).toContain("function corridorRangeClass(tone: DispersionCorridorTone)");
    expect(chartsSource).toContain('if (tone === "left") return "text-destructive"');
    expect(chartsSource).toContain('return "text-[var(--status-information-foreground)]"');
  });
});
