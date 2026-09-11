import { describe, expect, it } from "vitest";
import { evaluateRealRoundAchievements, REAL_ROUND_ACHIEVEMENTS } from "./real-rounds";
import { evaluateRoundScorecardAchievements } from "./evaluator";
import type { AchievementSession } from "./types";

function card(overrides: Partial<AchievementSession> = {}): AchievementSession {
  const pars = [4, 5, 4, 4, 3, 3, 4, 4, 5, 4, 5, 3, 4, 3, 4, 4, 3, 5];
  const scores = [5, 6, 5, 5, 4, 4, 6, 4, 5, 5, 4, 3, 4, 3, 5, 5, 4, 6];
  return {
    id: "ellesmere",
    source: "manual",
    type: "real_round",
    date: new Date("2026-09-11T11:00:00Z"),
    roundStatus: "complete",
    scorecardJson: pars.map((par, i) => ({
      holeNumber: i + 1,
      par,
      yards: 0,
      score: scores[i],
      putts: [7, 10, 11, 12].includes(i) ? 1 : 2,
      penalties: 0,
      fairwayHit: par === 3 ? null : [1, 2, 6, 7, 8, 9, 10, 15].includes(i),
      gir: [8, 10, 13].includes(i),
    })),
    ...overrides,
  };
}
const ids = (sessions: AchievementSession[]) =>
  evaluateRealRoundAchievements(sessions).unlocks.map((u) => u.achievementId);

describe("real round achievements", () => {
  it("awards the uploaded 83 with scorecard evidence and 950 XP", () => {
    const result = evaluateRealRoundAchievements([card()]);
    expect(result.unlocks).toHaveLength(10);
    expect(ids([card()])).toContain("real_break_85");
    expect(ids([card()])).not.toContain("real_break_80");
    expect(ids([card()])).not.toContain("real_putts_30");
    expect(ids([card()])).not.toContain("real_greens_6");
    expect(result.unlocks.every((u) => u.sourceSessionId === "ellesmere")).toBe(true);
    expect(
      REAL_ROUND_ACHIEVEMENTS.filter((a) => ids([card()]).includes(a.id)).reduce(
        (sum, a) => sum + a.xp,
        0,
      ),
    ).toBe(950);
    expect(
      evaluateRoundScorecardAchievements(card()).unlocks.map((u) => u.achievementId),
    ).toContain("real_break_85");
  });
  it.each([
    { type: "sim_round" },
    { roundStatus: "active" },
    { scorecardJson: card().scorecardJson!.slice(0, 8) },
  ])("rejects ineligible cards %j", (overrides) => expect(ids([card(overrides)])).toEqual([]));
  it("rejects duplicate holes and zero scores", () => {
    for (const patch of [{ holeNumber: 2 }, { score: 0 }]) {
      const session = card();
      Object.assign(session.scorecardJson![0], patch);
      expect(ids([session])).toEqual([]);
    }
  });
  it("does not treat missing stats as zero or complete evidence", () => {
    const session = card();
    Object.assign(session.scorecardJson![0], {
      putts: null,
      penalties: null,
      fairwayHit: null,
      gir: null,
    });
    const earned = ids([session]);
    for (const id of [
      "real_no_three_putts",
      "real_putts_32",
      "real_penalty_free",
      "real_fairways_8",
      "real_greens_6",
    ])
      expect(earned).not.toContain(id);
    expect(earned).toContain("real_break_85");
  });
  it("requires strictly below scoring targets and a full length course", () => {
    const exact = card();
    exact.scorecardJson![0].score = 7;
    expect(ids([exact])).not.toContain("real_break_85");
    const short = card();
    short.scorecardJson!.forEach((h) => (h.par = 3));
    expect(ids([short]).filter((id) => id.startsWith("real_break"))).toEqual([]);
  });
  it("counts distinct completed eighteens chronologically", () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      card({ id: `round-${i}`, date: new Date(2026, 8, i + 1) }),
    );
    const result = evaluateRealRoundAchievements([...sessions].reverse().concat(sessions));
    expect(
      result.unlocks.find((u) => u.achievementId === "real_five_rounds")?.sourceSessionId,
    ).toBe("round-4");
    expect(result.unlocks.filter((u) => u.achievementId === "real_first_eighteen")).toHaveLength(1);
    expect(ids(sessions.slice(0, 4).concat(sessions[0]))).not.toContain("real_five_rounds");
  });
  it("accepts a back nine without awarding eighteen-hole milestones", () => {
    const session = card();
    session.scorecardJson = session.scorecardJson!.slice(9);
    expect(ids([session])).toContain("real_first_nine");
    expect(ids([session])).not.toContain("real_first_eighteen");
    expect(ids([session])).not.toContain("real_putts_32");
  });
});
