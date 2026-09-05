import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionTimeline, type SessionTimelineItem } from "@/app/sessions/session-timeline";
import { SessionsCompanionHistory } from "@/app/sessions/sessions-companion-list";
import { resolveSessionHistorySearchParams } from "@/lib/session-history-search-params";

const reviewSource = readFileSync(
  join(process.cwd(), "src/app/(app)/sessions/[sessionId]/page.tsx"),
  "utf8",
);
const historySource = readFileSync(join(process.cwd(), "src/lib/session-history.ts"), "utf8");
const mobileChartSource = readFileSync(
  join(process.cwd(), "src/components/app/mobile-shot-pattern-charts.tsx"),
  "utf8",
);
const timelineSource = readFileSync(
  join(process.cwd(), "src/app/sessions/session-timeline.tsx"),
  "utf8",
);
const companionListSource = readFileSync(
  join(process.cwd(), "src/app/sessions/sessions-companion-list.tsx"),
  "utf8",
);

function session(index: number): SessionTimelineItem {
  return {
    id: `session-${index}`,
    isRound: index % 3 === 0,
    title: `A deliberately long session name ${index} that should remain readable`,
    dateGroup: index === 0 ? "Today" : index < 5 ? "This week" : "Earlier",
    dateLabel: `${String(index).padStart(2, "0")} Aug 2026`,
    shotCount: index + 20,
    resultLabel: index % 3 === 0 ? `${72 + index} gross` : `${index + 20} shots`,
    sourceLabel: "Rapsodo",
    typeLabel: index % 3 === 0 ? "Round" : "Range",
    contextLabel: "Practice",
    clubs: ["7i"],
    clubsLabel: "7i",
    notes: null,
    equipmentNotes: index === 2 ? "Changed ball" : null,
    verdict: "Measured review ready",
    mainImprovement: "A measured baseline is ready.",
    mainIssue: "The typical miss finished right.",
    planLinked: index === 1,
    importedEvidence: index % 2 === 0 && index % 3 !== 0,
    roundScoreLabel: index % 3 === 0 ? `${72 + index} gross` : null,
    evidenceConfidence: "High",
    points: [],
    importantMetrics: [
      { label: "Measured shots", value: String(index + 20) },
      { label: "Average carry", value: "150 yd" },
    ],
  };
}

describe("SessionTimeline golf history", () => {
  it("renders date-grouped desktop rows, filters and a persistent review preview", () => {
    const markup = renderToStaticMarkup(
      <SessionTimeline sessions={Array.from({ length: 13 }, (_, index) => session(index))} />,
    );

    expect(markup).toContain("A deliberately long session name 0");
    expect(markup).toContain("A deliberately long session name 12");
    expect(markup).toContain('data-sessions-history-workbench="true"');
    expect(markup).toContain('data-selected-session-preview="true"');
    expect(markup).toContain("Today");
    expect(markup).toContain("This week");
    expect(markup).toContain("Earlier");
    expect(markup).toContain("72 gross");
    expect(markup).toContain("All");
    expect(markup).toContain("Practice");
    expect(markup).toContain("Rounds");
    expect(markup).toContain("Source");
    expect(markup).toContain("Club");
    expect(markup).toContain("Date");
    expect(markup).toContain("Open full review");
    expect(markup).toContain("Measured review ready");
    expect(markup).not.toContain('data-session-compare-tray="true"');
  });

  it("keeps empty history deterministic without showing comparison UI", () => {
    const markup = renderToStaticMarkup(<SessionTimeline sessions={[]} />);

    expect(markup).toContain("0 of 0");
    expect(markup).toContain("No sessions match these filters");
    expect(markup).not.toContain('data-session-compare-tray="true"');
  });

  it("uses a two-column master-detail workbench with compact evidence, charts and a sticky compare bar", () => {
    expect(timelineSource).toContain("data-session-master-detail");
    expect(timelineSource).toContain("lg:grid-cols-");
    expect(timelineSource).toContain("<PatternThumbnail");
    expect(timelineSource).toContain("Main improvement");
    expect(timelineSource).toContain("Main issue");
    expect(timelineSource).toContain("Important metrics");
    expect(timelineSource).toContain("<SessionHistoryFilterSheet");
    expect(timelineSource).toContain("<Item");
    expect(timelineSource).toContain("<Skeleton");
    expect(timelineSource.indexOf("data-session-master-detail")).toBeLessThan(
      timelineSource.indexOf("data-session-compare-tray"),
    );
    expect(timelineSource).not.toContain("ConnectedMetricBar");
    expect(timelineSource).not.toContain("ResponsiveDetailPanel");
  });

  it("keeps URL-backed All, Practice and Rounds controls on both surfaces", () => {
    expect(companionListSource).toContain("Your golf history");
    expect(timelineSource).toContain("<Tabs");
    expect(timelineSource).toContain("<TabsList");
    expect(timelineSource).toContain('<TabsTrigger value="all">All</TabsTrigger>');
    expect(timelineSource).toContain('<TabsTrigger value="practice">Practice</TabsTrigger>');
    expect(timelineSource).toContain('<TabsTrigger value="round">Rounds</TabsTrigger>');
    expect(companionListSource).toContain("MobileSegmentedControl");
    expect(companionListSource).toContain('{ value: "all", label: "All" }');
    expect(companionListSource).toContain('{ value: "practice", label: "Practice" }');
    expect(companionListSource).toContain('{ value: "round", label: "Rounds" }');
    expect(companionListSource).toContain("<StatusTimeline");
    expect(timelineSource).toContain("useSessionHistoryUrlState");
    expect(companionListSource).toContain("useSessionHistoryUrlState");
    expect(companionListSource).toContain("filters.sessionId");
    expect(companionListSource).toContain('label="Focus"');
    expect(companionListSource).not.toContain("data-session-compare-tray");
  });

  it("renders controlled bookmark filters and keeps preview and compare controls separate", () => {
    const markup = renderToStaticMarkup(
      <SessionTimeline
        sessions={Array.from({ length: 13 }, (_, index) => session(index))}
        filters={{
          type: "round",
          source: "all",
          club: "all",
          date: "all",
          sessionId: "session-3",
        }}
      />,
    );

    expect(markup).toContain("5 of 13");
    expect(markup).toContain('data-session-inspect="true"');
    expect(markup).toContain('aria-label="Preview A deliberately long session name 3');
    expect(markup).toContain('aria-label="Select A deliberately long session name 3');
    expect(timelineSource).not.toContain('role="button"');
    expect(timelineSource).not.toContain("onKeyDown=");
  });

  it("treats the same session query as focus on both surfaces without collapsing history", () => {
    const sessions = Array.from({ length: 13 }, (_, index) => session(index));
    const { filters } = resolveSessionHistorySearchParams(
      "type=practice&session=session-1",
      sessions,
    );
    const workbenchMarkup = renderToStaticMarkup(
      <SessionTimeline sessions={sessions} filters={filters} />,
    );
    const companionMarkup = renderToStaticMarkup(
      <SessionsCompanionHistory
        sessions={sessions}
        accountId="test-account"
        filters={filters}
        onFiltersChange={() => undefined}
        onClearFilters={() => undefined}
      />,
    );

    for (const markup of [workbenchMarkup, companionMarkup]) {
      expect(markup).toContain("8 of 13");
      expect(markup).toContain("A deliberately long session name 1");
      expect(markup).toContain("A deliberately long session name 2");
      expect(markup).not.toContain("A deliberately long session name 0");
    }

    expect(workbenchMarkup).toContain('aria-label="Preview A deliberately long session name 1');
    expect(workbenchMarkup).toContain('aria-pressed="true"');
    expect(companionMarkup).toContain("Focused · 21 shots");
    expect(
      companionMarkup.match(
        /<article[^>]*data-timeline-featured="true"[^>]*>[\s\S]*?<\/article>/,
      )?.[0],
    ).toContain("A deliberately long session name 1");
  });

  it("offers Clear for a focus-only bookmark without reducing either surface's history count", () => {
    const sessions = Array.from({ length: 13 }, (_, index) => session(index));
    const { filters } = resolveSessionHistorySearchParams("session=session-1", sessions);
    const workbenchMarkup = renderToStaticMarkup(
      <SessionTimeline sessions={sessions} filters={filters} />,
    );
    const companionMarkup = renderToStaticMarkup(
      <SessionsCompanionHistory
        sessions={sessions}
        accountId="test-account"
        filters={filters}
        onFiltersChange={() => undefined}
        onClearFilters={() => undefined}
      />,
    );

    for (const markup of [workbenchMarkup, companionMarkup]) {
      expect(markup).toContain("13 of 13");
      expect(markup).toContain("Clear</button>");
      expect(markup).toContain("A deliberately long session name 12");
    }
  });

  it("keeps score and import evidence honest and upgrades the companion review composition", () => {
    expect(historySource).toContain("formatRoundScore");
    expect(historySource).toContain("recordedScores.length");
    expect(historySource).toContain("importedEvidence");
    expect(reviewSource).toContain("mobileSessionVerdict(comparisons)");
    expect(reviewSource).not.toContain("ResultHero");
    expect(reviewSource).toContain("ConnectedMetricBar");
    expect(reviewSource).toContain("data-plan-versus-actual");
    expect(reviewSource).toContain("<Progress");
    expect(reviewSource).toContain("<MobileGroupedList>");
    expect(reviewSource).toContain("MobileShotPatternCharts");
    expect(mobileChartSource).toContain("data-shot-detail-drawer");
    expect(mobileChartSource).toContain("<Drawer");
  });
});
