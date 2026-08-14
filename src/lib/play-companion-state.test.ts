import { describe, expect, it } from "vitest";

import {
  companionCourseReadiness,
  findInProgressRound,
  selectCompanionTee,
} from "@/lib/play-companion-state";

describe("Play companion state", () => {
  it("finds an older in-progress round even when the newest round is complete", () => {
    const round = findInProgressRound([
      { id: "new-complete", roundStatus: "complete", date: "2026-08-12" },
      { id: "open", roundStatus: "in_progress", date: "2026-08-11" },
      { id: "legacy", roundStatus: "active", date: "2026-08-10" },
    ]);
    expect(round?.id).toBe("open");
  });

  it("uses active, explicit and recent tee evidence before a labelled middle default", () => {
    const tees = [
      { id: "short", name: "Forward", yards: 5_100 },
      { id: "middle", name: "Club", yards: 6_100 },
      { id: "back", name: "Back", yards: 6_800 },
    ];
    expect(selectCompanionTee({ tees, activeRoundTeeId: "back" })?.id).toBe("back");
    expect(selectCompanionTee({ tees, explicitTeeId: "middle" })?.id).toBe("middle");
    expect(selectCompanionTee({ tees, recentRoundTeeId: "back" })?.id).toBe("back");
    expect(selectCompanionTee({ tees })?.id).toBe("middle");
  });

  it("preserves selected-tee metadata used by the pre-round briefing", () => {
    const selected = selectCompanionTee({
      tees: [{ id: "club", name: "Club", yards: 6_100, par: 72 }],
      explicitTeeId: "club",
    });

    expect(selected?.par).toBe(72);
  });

  it("keeps strategy readiness independent from Course Twin availability", () => {
    expect(
      companionCourseReadiness({ holeCount: 18, teeCount: 3, courseTwinAvailable: false }),
    ).toEqual({ strategyReady: true, courseTwinReady: false });
  });
});
