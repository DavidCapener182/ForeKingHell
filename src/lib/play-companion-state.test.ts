import { describe, expect, it } from "vitest";

import {
  activeRoundStrategy,
  initialRoundHoleIndex,
  companionCourseReadiness,
  findInProgressRound,
  selectCompanionTee,
} from "@/lib/play-companion-state";

describe("Play companion state", () => {
  it("keeps a fully scored but unfinished round on its final hole for completion", () => {
    expect(initialRoundHoleIndex([{ score: 4 }, { score: 5 }])).toBe(1);
    expect(initialRoundHoleIndex([{ score: 4 }, { score: null }, { score: null }])).toBe(1);
    expect(initialRoundHoleIndex([])).toBe(0);
  });
  it("opens the active round's own course, tee and first unscored hole", () => {
    const result = activeRoundStrategy({
      courseId: "active-course",
      teeSetId: "active-tee",
      scorecardJson: [
        { holeNumber: 3, score: null },
        { holeNumber: 1, score: 4 },
        { holeNumber: 2 },
      ],
    });
    expect(result.currentHole).toBe(2);
    const url = new URL(result.href!, "https://golf.test");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      courseId: "active-course",
      teeSetId: "active-tee",
      hole: "2",
    });
  });
  it("never invents a course or a nineteenth hole", () => {
    expect(activeRoundStrategy({ courseId: null, teeSetId: null, scorecardJson: [] })).toEqual({
      currentHole: 1,
      href: null,
    });
    expect(
      activeRoundStrategy({
        courseId: "course",
        teeSetId: null,
        scorecardJson: [{ holeNumber: 18, score: 5 }],
      }).currentHole,
    ).toBe(18);
  });
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
