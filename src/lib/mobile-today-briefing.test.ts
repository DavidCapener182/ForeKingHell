import { describe, expect, it } from "vitest";
import { buildMobileTodayChange, todayPlanAction } from "./mobile-today-briefing";
import type { ClubDayComparison, TodayPracticeShot } from "./today-session-data";

const snapshot = {
  shotCount: 6,
  carryAverageYd: 140,
  totalAverageYd: null,
  offlineAverageYd: null,
  straightRate: null,
  playableRate: null,
  bigMissRate: null,
  carryStdDevYd: null,
  carryRobustStdDevYd: null,
  ballSpeedAverageMph: null,
  smashAverage: null,
};
const comparison: ClubDayComparison = {
  clubType: "7i",
  clubLabel: "7i",
  today: snapshot,
  previous: { ...snapshot, carryAverageYd: 144 },
  carryDeltaYd: -4,
  offlineDeltaYd: null,
  straightRateDelta: null,
  playableRateDelta: null,
  bigMissRateDelta: null,
  consistencyDeltaYd: null,
  ballSpeedDeltaMph: null,
  smashDelta: null,
  score: 50,
  verdict: "mixed",
  summary: "Saved comparison",
};
function shot(id: string, sessionId: string, sessionType = "practice"): TodayPracticeShot {
  return {
    id,
    sessionId,
    sessionType,
    clubType: "7i",
    carryYd: 140,
    sessionDate: new Date("2026-08-22T12:00:00Z"),
    courseName: null,
  } as TodayPracticeShot;
}
describe("Today evidence and activity handoffs", () => {
  it("only resumes active activity and sends measured-review states to the exact plan", () => {
    const plan = { id: "saved-plan", title: "7 iron gates", status: "active" };
    expect(todayPlanAction(plan)).toMatchObject({
      kind: "active",
      href: "/practice?planId=saved-plan",
    });
    for (const status of ["awaiting_import", "completed"])
      expect(todayPlanAction({ ...plan, status })).toMatchObject({
        kind: "next",
        label: "Add measured shots",
        href: "/import?practicePlanId=saved-plan",
      });
    expect(todayPlanAction({ ...plan, status: "awaiting_import" }, "unfinished")).toMatchObject({
      kind: "active",
      label: "Resume Range Mode",
      href: "/practice?planId=saved-plan",
    });
    expect(todayPlanAction({ ...plan, status: "awaiting_import" }, "finished")?.label).toBe(
      "Add measured shots",
    );
    expect(todayPlanAction({ ...plan, status: "analysed" }, "unfinished")?.label).toBe(
      "Review your practice",
    );
    expect(todayPlanAction(plan, "finished")?.label).toBe("Add measured shots");
    for (const status of ["match_found", "analysed"])
      expect(todayPlanAction({ ...plan, status }, "finished")).toMatchObject({
        label: "Review your practice",
        href: "/practice?planId=saved-plan",
      });
    expect(todayPlanAction({ ...plan, status: "planned" })?.label).toBe("Your saved practice");
    expect(todayPlanAction({ ...plan, status: "abandoned" })).toBeNull();
    expect(todayPlanAction(null)).toBeNull();
  });
  it("retains the day averages and exposes every contributing upload with its correct review route", () => {
    const result = buildMobileTodayChange({
      dateLabel: "22 August 2026",
      clubComparisons: [comparison],
      comparisonShots: Array.from({ length: 6 }, (_, i) =>
        shot(String(i), i < 3 ? "practice-a" : "round-b", i < 3 ? "practice" : "simulated_course"),
      ),
      previousComparisonShots: Array.from({ length: 6 }, (_, i) => shot(`old-${i}`, "earlier")),
    });
    expect(result).toMatchObject({
      clubLabel: "7 Iron",
      delta: -4,
      latest: { value: 140, count: 6 },
      previous: { value: 144, count: 6 },
    });
    expect(result?.latest.sessions.map((s) => [s.href, s.count])).toEqual([
      ["/sessions/practice-a", 3],
      ["/rounds/round-b", 3],
    ]);
    expect(result?.previous.sessions[0].href).toBe("/sessions/earlier");
  });
  it("does not publish a change without comparable carry readings", () => {
    const data = {
      dateLabel: "22 August 2026",
      clubComparisons: [comparison],
      comparisonShots: [shot("a", "latest")],
      previousComparisonShots: [shot("b", "previous")],
    };
    expect(
      buildMobileTodayChange({ ...data, clubComparisons: [{ ...comparison, verdict: "new" }] }),
    ).toBeNull();
    expect(
      buildMobileTodayChange({
        ...data,
        comparisonShots: [{ ...shot("a", "latest"), carryYd: null }],
      }),
    ).toBeNull();
    expect(buildMobileTodayChange(null)).toBeNull();
  });
});
