import { describe, expect, it } from "vitest";
import { buildTodayClubTrends } from "./today-club-trends";
import type { TodayPracticeShot } from "./today-session-data";
const shot = (
  sessionId: string,
  carryYd: number | null,
  overrides: Partial<TodayPracticeShot> = {},
) =>
  ({
    id: `${sessionId}-${carryYd}`,
    sessionId,
    clubId: "driver",
    clubType: "driver",
    clubBrand: null,
    clubModel: null,
    source: "rapsodo",
    sessionType: "range",
    shotAt: new Date(sessionId === "current" ? "2026-10-01T12:00:00Z" : "2026-09-20T12:00:00Z"),
    carryYd,
    totalYd: carryYd === null ? null : carryYd + 20,
    ballSpeedMph: 130,
    clubSpeedMph: 90,
    smashFactor: 1.44,
    launchAngleDeg: 14,
    reviewStatus: "included",
    shotCategory: "full",
    qualityTag: null,
    dataIntegrityIssue: null,
    ...overrides,
  }) as TodayPracticeShot;
describe("club session trends", () => {
  it("retains speed evidence when explicit full shots have no carry reading", () => {
    const [club] = buildTodayClubTrends([shot("current", null)], ["current"]);
    expect(club.points[0].values.carryYd).toBeNull();
    expect(club.points[0].values.ballSpeedMph).toBe(130);
  });
  it("averages sessions individually and counts each metric independently", () => {
    const [club] = buildTodayClubTrends(
      [shot("previous", 200), shot("current", 210), shot("current", 220, { totalYd: null })],
      ["current"],
    );
    expect(club.points.map((point) => point.values.carryYd)).toEqual([200, 215]);
    expect(club.points[1].values.totalYd).toBe(230);
    expect(club.points[1].counts.totalYd).toBe(1);
    expect(club.points[1].current).toBe(true);
  });
  it("never pools different devices, contexts or club identities", () => {
    const clubs = buildTodayClubTrends(
      [
        shot("previous", 200),
        shot("current", 210),
        shot("previous", 260, { source: "trackman" }),
        shot("previous", 280, { clubId: "old-driver" }),
        shot("previous", 290, { sessionType: "simulator" }),
      ],
      ["current"],
    );
    expect(clubs).toHaveLength(1);
    expect(clubs[0].points[0].values.carryYd).toBe(200);
  });
  it("omits excluded and partial shots without fabricating missing metrics", () => {
    const [club] = buildTodayClubTrends(
      [
        shot("current", 210),
        shot("current", 10, { shotCategory: "chip" }),
        shot("current", 30, { shotCategory: "pitch" }),
        shot("current", 300, { reviewStatus: "user_excluded" }),
        shot("previous", 190, { clubSpeedMph: null }),
      ],
      ["current"],
    );
    expect(club.points[1].counts.carryYd).toBe(1);
    expect(club.points[0].values.clubSpeedMph).toBeNull();
    expect(club.points[0].counts.clubSpeedMph).toBe(0);
  });
});

// Shared contract: all pages use these calculations and immediate-session baselines.
import {
  buildClubProgress,
  compareClubSessions,
  describeSessionTrend,
  metricReading,
  rollingSessionAverage,
  sessionTradeoffs,
} from "./today-club-trends";
import { parseProgressPreferences, resolveProgressSelection } from "./club-progress-preferences";
const session = (
  id: string,
  day: number,
  overrides: Partial<TodayPracticeShot> = {},
  readings = 3,
) =>
  Array.from({ length: readings }, (_, i) =>
    shot(id, 150 + i, {
      id: `${id}-${i}`,
      sessionDate: new Date(`2026-09-${String(day).padStart(2, "0")}T12:00:00Z`),
      playContext: "outdoor",
      shotPlayContext: "outdoor",
      sideCarryYd: i % 2 ? -10 : 10,
      ...overrides,
    }),
  );
describe("shared club progress evidence contract", () => {
  it("keeps actual saved identities even with identical club types and labels", () => {
    const result = buildClubProgress(
      [...session("a", 1), ...session("b", 2, { clubId: "second" })],
      null,
    );
    expect(result.clubs).toHaveLength(2);
    expect(result.clubs.map((c) => c.clubId)).toEqual(["driver", "second"]);
  });
  it("separates unknown, indoor and outdoor context and session/shot metadata", () => {
    const result = buildClubProgress(
      [
        ...session("a", 1),
        ...session("b", 2, { playContext: "indoor" }),
        ...session("c", 3, { playContext: undefined }),
        ...session("d", 4, { source: "trackman" }),
        ...session("e", 5, { shotPlayContext: "unknown" }),
      ],
      null,
    );
    expect(result.clubs).toHaveLength(5);
    expect(result.clubs.some((c) => c.playContext === "unknown")).toBe(true);
  });
  it("retains same-day uploads independently and cuts off future historical evidence", () => {
    const [c] = buildTodayClubTrends(
      [
        ...session("a", 1),
        ...session("b", 1, { sessionDate: new Date("2026-09-01T13:00:00Z") }),
        ...session("future", 2),
      ],
      ["b"],
    );
    expect(c.points.map((p) => p.sessionId)).toEqual(["a", "b"]);
    expect(c.points[0].date).toContain("13:00"); // London BST
    expect(compareClubSessions(c, "b", "carryYd").previous?.sessionId).toBe("a");
  });
  it("does not skip an immediate predecessor missing the chosen metric", () => {
    const [c] = buildTodayClubTrends(
      [...session("a", 1), ...session("b", 2, { carryYd: null }), ...session("c", 3)],
      ["c"],
    );
    const comparison = compareClubSessions(c, "c", "carryYd");
    expect(comparison.previous?.sessionId).toBe("b");
    expect(comparison.delta).toBeNull();
    expect(comparison.text).toBe("Previous reading unavailable");
  });
  it("does not cap eligible series at twelve; sparse metric readings still count as sessions", () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      session(`s${i}`, i + 1, { totalYd: i === 10 ? null : 170 }),
    ).flat();
    const [c] = buildClubProgress(rows, null).clubs;
    expect(c.points).toHaveLength(25);
    expect(c.points[10].values.totalYd).toBeNull();
    expect(c.points.slice(-20)).toHaveLength(20);
    expect(buildClubProgress(session("only", 1), null).clubs[0].points).toHaveLength(1);
  });
  it("does not cancel opposite lateral misses", () => {
    const [c] = buildTodayClubTrends(
      [shot("current", 150, { sideCarryYd: -12 }), shot("current", 150, { sideCarryYd: 12 })],
      ["current"],
    );
    expect(c.points[0].values.accuracy).toBe(12);
  });
  it("uses sample deviation and requires two readings, without distance trimming", () => {
    const [c] = buildTodayClubTrends(
      [shot("previous", 100), shot("current", 100), shot("current", 200)],
      ["current"],
    );
    expect(c.points[0].values.consistency).toBeNull();
    expect(c.points[1].values.consistency).toBeCloseTo(Math.sqrt(5000));
  });
  it("excludes explicit partial, recovery and round shots before stock-role heuristics", () => {
    const rows = ["partial", "half", "recovery", "pitch", "chip"].map((shotCategory) =>
      shot("current", 200, { shotCategory }),
    );
    expect(
      buildTodayClubTrends([...rows, shot("current", 220, { sessionType: "round" })], ["current"]),
    ).toEqual([]);
  });
  it("does not infer full-shot intent from speed-only data", () => {
    expect(
      buildTodayClubTrends([shot("current", null, { shotCategory: null })], ["current"]),
    ).toEqual([]);
    const [c] = buildTodayClubTrends([shot("current", null)], ["current"]);
    expect(c.points[0].counts.ballSpeedMph).toBe(1);
    expect(c.points[0].counts.carryYd).toBe(0);
  });
  it("honours review exclusions and restored integrity rows", () => {
    const statuses = [
      "warm_up",
      "calibration",
      "launch_monitor_error",
      "suggested_exclusion",
      "user_excluded",
    ] as const;
    const [c] = buildTodayClubTrends(
      [
        ...statuses.map((reviewStatus) => shot("current", 200, { reviewStatus })),
        shot("current", 150, { reviewStatus: "restored", dataIntegrityIssue: "trajectory-review" }),
      ],
      ["current"],
    );
    expect(c.points[0].shotCount).toBe(1);
    expect(c.points[0].values.carryYd).toBe(150);
  });
  it("masks questioned direction while keeping distance and speed", () => {
    const [c] = buildTodayClubTrends(
      [shot("current", 150, { sideCarryYd: 25, dataConfidence: { alignment: "misaligned" } })],
      ["current"],
    );
    expect(c.points[0].values.accuracy).toBeNull();
    expect(c.points[0].values.carryYd).toBe(150);
    expect(c.points[0].values.ballSpeedMph).toBe(130);
  });
  it("keeps measured and estimated club readings apart, including smash", () => {
    const [c] = buildTodayClubTrends(
      [
        shot("current", 150, { clubDataEstType: "measured", clubSpeedMph: 90, smashFactor: 1.4 }),
        shot("current", 150, { clubDataEstType: "estimated", clubSpeedMph: 110, smashFactor: 1.6 }),
        shot("previous", 150, { clubDataEstType: "estimated" }),
      ],
      ["current"],
    );
    expect(c.defaultEvidence).toBe("measured");
    expect(metricReading(c.points[1], "clubSpeedMph", "measured")).toEqual({ value: 90, count: 1 });
    expect(metricReading(c.points[1], "smashFactor", "estimated").value).toBe(1.6);
    expect(compareClubSessions(c, "current", "clubSpeedMph").text).toBe(
      "Previous reading unavailable",
    );
  });
  it("retains low samples and adds early-signal and unequal-sample wording", () => {
    const [c] = buildTodayClubTrends(
      [...session("a", 1, {}, 1), ...session("b", 2, {}, 12)],
      ["b"],
    );
    const result = compareClubSessions(c, "b", "carryYd");
    expect(result.delta).not.toBeNull();
    expect(result.text).toBe("Building a baseline");
    expect(result.sampleContext).toContain("early signal");
    expect(result.sampleContext).toContain("Unequal samples");
  });
  it("reports distance/control trade-offs without an overall performance verdict", () => {
    const [c] = buildTodayClubTrends(
      [
        ...session("a", 1, { carryYd: 150, sideCarryYd: 5 }),
        ...session("b", 2, { carryYd: 160, sideCarryYd: 10 }),
      ],
      ["b"],
    );
    expect(sessionTradeoffs(c, "b")).toBe("Longer carry with more lateral miss.");
  });
  it("rolling averages weight sessions equally and break at missing readings", () => {
    expect(rollingSessionAverage([10, 20, 90, null, 50, 60, 70])).toEqual([
      null,
      null,
      40,
      null,
      null,
      null,
      60,
    ]);
  });
  it("requires five adequately sampled sessions for a descriptive regression", () => {
    const [c] = buildClubProgress(
      Array.from({ length: 5 }, (_, i) =>
        session(`s${i}`, i + 1, { carryYd: 150 + 5 * i }, 3),
      ).flat(),
      null,
    ).clubs;
    expect(describeSessionTrend(c.points.slice(0, 2), "carryYd", "measured")).toContain("five");
    expect(describeSessionTrend(c.points, "carryYd", "measured")).toContain("longer carry");
    expect(describeSessionTrend(c.points, "carryYd", "measured")).toContain("equal-session");
  });
  it("distinguishes empty scope, failed history, bounded history and first evidence", () => {
    expect(buildClubProgress(session("a", 1), []).clubs).toEqual([]);
    const [c] = buildTodayClubTrends(session("a", 1), ["a"]);
    expect(compareClubSessions(c, "a", "carryYd", "measured", "failed").text).toBe(
      "History loading failed",
    );
    expect(compareClubSessions(c, "a", "carryYd", "measured", "bounded").text).toContain(
      "loading bound",
    );
    expect(compareClubSessions(c, "a", "carryYd").text).toBe("First comparable session");
  });
  it("omits inactive/unidentified clubs and invalid dates; explicitly qualifies tied timestamps", () => {
    const result = buildClubProgress(
      [
        ...session("a", 1),
        ...session("b", 1),
        ...session("invalid", 2, { sessionDate: new Date("invalid") }),
        ...session("inactive", 3, { clubActive: false }),
        ...session("no-id", 4, { clubId: undefined }),
      ],
      null,
    );
    expect(result.invalidSessionCount).toBe(1);
    expect(result.clubs[0].points).toHaveLength(2);
    expect(compareClubSessions(result.clubs[0], "b", "carryYd").adequate).toBe(false);
    expect(compareClubSessions(result.clubs[0], "b", "carryYd").text).toContain("ambiguous");
  });
  it("shares valid preferences but never replaces an explicit unavailable scope", () => {
    const clubs = buildClubProgress(session("a", 1), null).clubs;
    const saved = {
      version: 1 as const,
      clubId: "driver",
      metric: "accuracy" as const,
      window: 20 as const,
    };
    expect(resolveProgressSelection(clubs, new URLSearchParams(), saved).metric).toBe("accuracy");
    expect(
      resolveProgressSelection(clubs, new URLSearchParams("cpMetric=totalYd&cpWindow=5"), saved)
        .window,
    ).toBe(5);
    expect(
      resolveProgressSelection(clubs, new URLSearchParams("cpClub=missing"), saved).unavailable,
    ).toBe(true);
    expect(
      resolveProgressSelection(clubs, new URLSearchParams("cpSession=empty"), saved).unavailable,
    ).toBe(true);
    expect(
      resolveProgressSelection(clubs, new URLSearchParams(), { version: 1, clubId: "stale" }).club
        ?.clubId,
    ).toBe("driver");
    expect(parseProgressPreferences("broken")).toEqual({ version: 1 });
    expect(parseProgressPreferences('{"version":2,"metric":"accuracy"}')).toEqual({ version: 1 });
  });
});
