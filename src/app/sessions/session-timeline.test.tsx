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
  };
}

describe("SessionTimeline mobile hierarchy", () => {
  it("keeps the newest ten sessions scannable and discloses the archive", () => {
    const markup = renderToStaticMarkup(
      <SessionTimeline sessions={Array.from({ length: 13 }, (_, index) => session(index))} />,
    );

    expect(markup).toContain("A deliberately long session name 0");
    expect(markup).toContain("A deliberately long session name 9");
    expect(markup).toContain("Older sessions");
    expect(markup).toContain("Continue through the archive");
    expect(markup).toContain("line-clamp-2");
    expect(markup).toContain(
      "Select A deliberately long session name 0 that should remain readable for comparison",
    );
    expect(markup).not.toContain("Compare · 0/2");
  });

  it("renders a useful empty row for a filtered-empty timeline", () => {
    const markup = renderToStaticMarkup(<SessionTimeline sessions={[]} />);

    expect(markup).toContain("No sessions in this view");
    expect(markup).toContain("Choose another session type or import new measured data.");
  });
});
