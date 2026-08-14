import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionTimeline, type SessionTimelineItem } from "@/app/sessions/session-timeline";

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
    dateLabel: `${String(index).padStart(2, "0")} Aug 2026`,
    shotCount: index + 20,
    sourceLabel: "Rapsodo",
    typeLabel: index % 3 === 0 ? "Round" : "Range",
    contextLabel: "Practice",
    notes: null,
    equipmentNotes: index === 2 ? "Changed ball" : null,
    verdict: "Measured review ready",
    planLinked: index === 1,
    importedEvidence: index % 2 === 0 && index % 3 !== 0,
    roundScoreLabel: index % 3 === 0 ? `${72 + index} gross` : null,
    evidenceConfidence: "High",
  };
}

describe("SessionTimeline mobile hierarchy", () => {
  it("renders date-grouped status nodes with tabs and review actions", () => {
    const markup = renderToStaticMarkup(
      <SessionTimeline sessions={Array.from({ length: 13 }, (_, index) => session(index))} />,
    );

    expect(markup).toContain("A deliberately long session name 0");
    expect(markup).toContain("A deliberately long session name 12");
    expect(markup).toContain('data-status-timeline="true"');
    expect(markup).toContain('data-timeline-kind="round"');
    expect(markup).toContain('data-timeline-kind="practice"');
    expect(markup).toContain('data-timeline-kind="import"');
    expect(markup).toContain("72 gross");
    expect(markup).toContain("Review · High");
    expect(markup).toContain("All");
    expect(markup).toContain("Practice");
    expect(markup).toContain("Rounds");
    expect(markup).toContain("Open review");
    expect(markup).toContain("Measured review ready");
    expect(markup).toContain("Compare tray · 0/2 selected");
  });

  it("keeps the selection tray deterministic when the route has no rows", () => {
    const markup = renderToStaticMarkup(<SessionTimeline sessions={[]} />);

    expect(markup).toContain("0 sessions and rounds");
    expect(markup).toContain("Choose two sessions from the timeline.");
  });

  it("uses a searchable responsive master-detail workbench above the compare tray", () => {
    expect(timelineSource).toContain("<DataToolbar");
    expect(timelineSource).toContain("data-session-master-detail");
    expect(timelineSource).toContain("<ResponsiveDetailPanel");
    expect(timelineSource).toContain("inlineAtUltrawide");
    expect(timelineSource).toContain("<ConnectedMetricBar");
    expect(timelineSource).toContain("Inspect");
    expect(timelineSource.indexOf("data-session-master-detail")).toBeLessThan(
      timelineSource.indexOf("data-session-compare-tray"),
    );
    const detail =
      timelineSource.match(/<ResponsiveDetailPanel[\s\S]*?<\/ResponsiveDetailPanel>/)?.[0] ?? "";
    expect(detail).toContain("<Item");
    expect(detail).toContain("embedded");
    expect(detail).not.toContain("<Card");
  });

  it("uses controlled ToggleGroups for filters without orphaned tab panels", () => {
    expect(companionListSource).toContain("Recent sessions");
    for (const filterSource of [timelineSource, companionListSource]) {
      expect(filterSource).toContain("<ToggleGroup");
      expect(filterSource).toContain('type="single"');
      expect(filterSource).toContain("if (value) setFilter");
      expect(filterSource).not.toContain("<Tabs");
      expect(filterSource).not.toContain("TabsTrigger");
    }
  });

  it("keeps score and import evidence honest and upgrades the companion review composition", () => {
    expect(historySource).toContain("formatRoundScore");
    expect(historySource).toContain("recordedScores.length");
    expect(historySource).toContain("importedEvidence");
    expect(reviewSource).toContain("ResultHero");
    expect(reviewSource).toContain("ConnectedMetricBar");
    expect(reviewSource).toContain("data-plan-versus-actual");
    expect(reviewSource).toContain("<Progress");
    expect(reviewSource).toContain("<ButtonGroup");
    expect(reviewSource).toContain("MobileShotPatternCharts");
    expect(mobileChartSource).toContain("data-shot-detail-drawer");
    expect(mobileChartSource).toContain("<Drawer");
  });
});
