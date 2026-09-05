import { describe, expect, it } from "vitest";
import {
  mobilePerformanceStory,
  mobileScoringStory,
  mobileTrainingConsistency,
} from "./mobile-progress-story";
import { calculateClubAnalytics } from "./club-analytics";
import type { ProgressClub } from "./progress-summary";
function club(id: string, side: number | null, carry = 0): ProgressClub {
  const analytics = calculateClubAnalytics({ shots: [], clubType: "7i" });
  const snapshot = {
    label: "Session",
    shotCount: 10,
    carryMedianYd: 150,
    absoluteOfflineAverageYd: 10,
    ballSpeedAverageMph: null,
    launchAverageDeg: null,
    clubPathAverageDeg: null,
  };
  analytics.progress = {
    ...analytics.progress,
    previousSession: snapshot,
    latestSession: {
      ...snapshot,
      carryMedianYd: 150 + carry,
      absoluteOfflineAverageYd: side === null ? null : 10 + side,
    },
    lastSessionDelta: {
      label: "Sessions",
      offlineDeltaYd: side,
      carryDeltaYd: carry,
      ballSpeedDeltaMph: null,
      launchDeltaDeg: null,
      clubPathDeltaDeg: null,
    },
  };
  return { clubId: id, clubType: "7i", brandModel: "", analytics };
}
describe("mobile progress evidence", () => {
  it("does not turn trust or overlapping baseline windows into improvement", () => {
    const c = club("one", 0);
    c.analytics.consistency.clubTrustIndex = 100;
    expect(mobilePerformanceStory([c]).label).toBe("Holding steady");
    c.analytics.progress.lastSessionDelta = null;
    expect(mobilePerformanceStory([c]).label).toBe("Building your baseline");
  });
  it("keeps mixed control visible and distance changes neutral", () => {
    expect(mobilePerformanceStory([club("a", -3), club("b", 4)]).label).toBe("Control is mixed");
    const distance = mobilePerformanceStory([club("a", null, 12)]);
    expect(distance.label).toBe("Distances are changing");
    expect(distance.tone).toBe("neutral");
  });
  it("requires both session samples and never assigns high confidence to three shots", () => {
    const c = club("a", -3);
    c.analytics.progress.previousSession!.shotCount = 2;
    expect(mobilePerformanceStory([c]).signal).toBeNull();
    c.analytics.progress.previousSession!.shotCount = 3;
    expect(mobilePerformanceStory([c]).confidence).toBe("Early signal");
  });
  it("does not call missing measurements a steady trend", () => {
    const c = club("missing", null);
    c.analytics.progress.lastSessionDelta!.carryDeltaYd = null;
    expect(mobilePerformanceStory([c]).label).toBe("Building your baseline");
  });
  it("counts distinct training days inside the last 28 days and ignores future logs", () => {
    const m = (date: string) => ({ date, sessionCount: 1, totalLoad: 20, title: "Range" });
    expect(
      mobileTrainingConsistency(
        [m("2026-09-05"), m("2026-09-05"), m("2026-09-06"), m("2026-08-01")],
        "2026-09-05",
      ),
    ).toEqual({ days: 1, sessions: 2, last: "2026-09-05", daysSince: 0 });
  });
  it("separates simulator and course results, preserves actual nine-hole totals and skips live rounds", () => {
    const r = (id: string, type: string, roundStatus = "complete", holes = 9) => ({
      id,
      type,
      roundStatus,
      scorecardJson: Array.from({ length: holes }, (_, i) => ({
        holeNumber: i + 1,
        par: 4,
        score: 5,
        penalties: i === 0 ? 2 : 0,
      })),
    });
    const story = mobileScoringStory([
      r("live", "real_round", "active"),
      r("nine", "real_round"),
      r("sim", "sim_round"),
      r("18", "real_round", "complete", 18),
    ]);
    expect(story.comparable.map((r) => r.id)).toEqual(["nine"]);
    expect(story.latest?.scorecardJson.reduce((n, h) => n + h.score, 0)).toBe(45);
    expect(story.leak?.title).toBe("2 penalty strokes");
  });
});
