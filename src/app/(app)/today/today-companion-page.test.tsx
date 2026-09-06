import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticePlannerContext } from "@/lib/practice-planner";
import type { TodayPracticeData, TodayPracticeShot } from "@/lib/today-session-data";
import { buildMobileTodayReview, practiceDateKey } from "@/lib/mobile-today-review";

vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "owner" }));
vi.mock("@/lib/practice-planner", () => ({
  getPracticePlannerContext: vi.fn(),
  getCurrentPracticePlanSummary: vi.fn(async () => null),
}));
vi.mock("@/lib/today-session-data", () => ({ getTodayPracticeData: vi.fn() }));
vi.mock("@/lib/today-activity-data", () => ({ getTodayActivity: async () => [] }));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }),
    }),
  }),
}));
vi.mock("@/components/app/lazy-mobile-shot-pattern-charts", () => ({
  LazyMobileShotPatternCharts: () => <div>Interactive shot patterns</div>,
}));
import { getPracticePlannerContext } from "@/lib/practice-planner";
import { getTodayPracticeData } from "@/lib/today-session-data";
import TodayCompanionPage from "./today-companion-page";

const now = new Date("2026-09-06T16:30:00Z");
function practice(): TodayPracticeData {
  const rawShots = Array.from(
    { length: 63 },
    (_, index) =>
      ({
        id: `shot-${index}`,
        sessionId: `session-${Math.floor(index / 21) + 1}`,
        sessionType: "range",
        source: "rapsodo",
        fileName: `upload-${Math.floor(index / 21) + 1}.csv`,
        shotAt: now,
        sessionDate: now,
        clubType: index < 3 ? "5w" : "7i",
        carryYd: 147.5,
        sideCarryYd: 2,
        apexFt: 70,
        ballSpeedMph: 105,
        launchAngleDeg: 18,
      }) as TodayPracticeShot,
  );
  const snapshot = {
    shotCount: 58,
    carryAverageYd: 147.5,
    totalAverageYd: 156,
    offlineAverageYd: 8,
    straightRate: 65,
    playableRate: 80,
    bigMissRate: 5,
    carryStdDevYd: 7,
    carryRobustStdDevYd: 6,
    ballSpeedAverageMph: 105,
    smashAverage: 1.32,
  };
  return {
    dateKey: "2026-09-06",
    dateLabel: "Sunday, 6 September 2026",
    sessions: [1, 2, 3].map((n) => ({
      id: `session-${n}`,
      label: `upload-${n}.csv`,
      type: "range",
      shotCount: 21,
    })),
    clubs: [
      { type: "5w", label: "5w", shotCount: 3, cleanShotCount: 3 },
      { type: "7i", label: "7i", shotCount: 60, cleanShotCount: 58 },
    ],
    rawShots,
    shots: rawShots.slice(0, 61),
    comparisonShots: rawShots.slice(0, 61),
    previousComparisonShots: [],
    overall: {
      verdict: "better",
      title: "Better than your previous baseline",
      summary: "Improved control",
      today: snapshot,
      previous: snapshot,
    },
    clubComparisons: [
      {
        clubType: "7i",
        clubLabel: "7i",
        today: snapshot,
        previous: { ...snapshot, shotCount: 50 },
        carryDeltaYd: 6,
        verdict: "better",
        summary: "offline down 2 yd / carry +6 yd",
        score: 2,
      },
    ],
    dataCleaning: { importedShotCount: 63, cleanShotCount: 61, excludedShotCount: 2 },
  } as unknown as TodayPracticeData;
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "test-only");
  vi.setSystemTime(now);
  vi.mocked(getTodayPracticeData).mockResolvedValue(practice());
  vi.mocked(getPracticePlannerContext).mockResolvedValue({
    latestPractice: {
      sessionId: "session-1",
      dateLabel: "Sunday, 6 September 2026",
      biggestOpportunity: "5w",
      clubs: [{ clubType: "5w", label: "5w", shotCount: 3, score: 0 }],
    },
    bag: { clubs: [], issues: [] },
    progress: { priorities: [] },
    trainingLoad: { statusLabel: "High", highRecentLoad: true },
    scoring: {},
    speed: null,
  } as unknown as PracticePlannerContext);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("mobile post-practice review", () => {
  it("renders the combined day before planning, without a low-confidence recommendation replacing the review", async () => {
    const html = renderToStaticMarkup(await TodayCompanionPage());
    expect(getTodayPracticeData).toHaveBeenCalledWith({
      date: "2026-09-06",
      scope: "day",
      practiceOnly: true,
    });
    expect(html).toContain("Practice complete · Today");
    expect(html).toContain("3 sessions · 63 shots · 2 clubs");
    expect(html).toContain('href="#today-practice-review"');
    expect(html).toContain("61 trusted shots");
    expect(html).toContain("2 excluded from analysis");
    for (const n of [1, 2, 3]) expect(html).toContain(`href="/sessions/session-${n}"`);
    expect(html).toContain("147.5 yd");
    expect(html).toContain("Interactive shot patterns");
    expect(html.indexOf("Club-by-club review")).toBeLessThan(
      html.indexOf("For your next practice"),
    );
    const hero = html.slice(0, html.indexOf('id="today-practice-review"'));
    expect(hero).not.toContain("Build 20 min practice");
    expect(hero).not.toContain("3 trusted shots");
    expect(hero).not.toContain("Review ready confidence");
  });

  it("shows the normal recommendation when there are no shots today", async () => {
    const data = practice();
    data.rawShots = [];
    vi.mocked(getTodayPracticeData).mockResolvedValue(data);
    const html = renderToStaticMarkup(await TodayCompanionPage());
    expect(html).toContain("For your next session");
    expect(html).toContain("Build 20 min practice");
    expect(html).not.toContain("Practice complete · Today");
  });

  it("keeps excluded uploads reviewable without claiming measured improvement", () => {
    const data = practice();
    data.shots = [];
    data.comparisonShots = [];
    data.clubComparisons = [];
    const review = buildMobileTodayReview(data, now);
    expect(review?.sessions).toHaveLength(3);
    expect(review?.state.reason).toContain("no comparable trusted full shots");
    expect(review?.state.reason).not.toContain("Better");
  });

  it("acknowledges an upload with too little evidence without calling it an improvement", () => {
    const data = practice();
    data.overall.verdict = "new";
    expect(buildMobileTodayReview(data, now)?.state.reason).toContain(
      "not enough comparable evidence",
    );
  });

  it("reports a loading failure instead of implying there was no practice today", async () => {
    vi.mocked(getTodayPracticeData).mockRejectedValue(new Error("unavailable"));
    const html = renderToStaticMarkup(await TodayCompanionPage());
    expect(html).toContain("Today’s review couldn’t load");
    expect(html).toContain('href="/sessions"');
    expect(html).not.toContain("Practice complete · Today");
  });

  it("does not present yesterday or a future day as practice completed today", () => {
    expect(buildMobileTodayReview({ ...practice(), dateKey: "2026-09-05" }, now)).toBeNull();
    expect(buildMobileTodayReview({ ...practice(), dateKey: "2026-09-07" }, now)).toBeNull();
    expect(buildMobileTodayReview(null, now)).toBeNull();
  });

  it("uses the London practice day across BST midnight and winter dates", () => {
    expect(practiceDateKey(new Date("2026-09-05T23:30:00Z"))).toBe("2026-09-06");
    expect(practiceDateKey(new Date("2026-12-05T23:30:00Z"))).toBe("2026-12-05");
  });
});
