import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionTimeline, type SessionTimelineItem } from "@/app/sessions/session-timeline";

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
});
