import { describe, expect, it } from "vitest";
import { summarizeTodayRound } from "./today-round-summary";
import type { TodayRound } from "./today-round-data";
export function roundFixture(): TodayRound {
  const scores = [5, 6, 5, 5, 4, 4, 6, 4, 5, 5, 4, 3, 4, 3, 5, 5, 4, 6];
  const pars = [4, 5, 4, 4, 3, 3, 4, 4, 5, 4, 5, 3, 4, 3, 4, 4, 3, 5];
  return {
    session: {
      id: "round",
      type: "real_round",
      date: new Date("2026-09-11T11:00:00Z"),
      courseName: "Ellesmere Port",
      notes: null,
      scorecardJson: scores.map((score, i) => ({
        holeNumber: i + 1,
        par: pars[i],
        score,
        yards: 0,
        name: null,
        putts: [8, 11, 12, 13].includes(i + 1) ? 1 : 2,
        fairwayHit: pars[i] === 3 ? null : [2, 3, 7, 8, 9, 10, 11, 16].includes(i + 1),
        gir: [9, 11, 14].includes(i + 1),
      })),
    },
    tee: null,
  } as TodayRound;
}
describe("round review evidence", () => {
  it("reconciles the supplied 18-hole round", () => {
    expect(summarizeTodayRound(roundFixture())).toMatchObject({
      gross: 83,
      par: 71,
      toPar: 12,
      front: 44,
      back: 39,
      putts: 32,
      fairways: { hit: 8, recorded: 13 },
      greens: { hit: 3, recorded: 18 },
      birdies: 1,
      pars: 5,
      bogeys: 11,
      doubles: 1,
    });
  });
  it("does not turn missing totals into zero or unknown results into misses", () => {
    const r = roundFixture();
    r.session.scorecardJson![0].putts = null;
    r.session.scorecardJson![0].gir = null;
    r.session.scorecardJson![0].fairwayHit = null;
    expect(summarizeTodayRound(r)).toMatchObject({
      putts: null,
      penalties: null,
      chips: null,
      net: null,
      fairways: { hit: 8, recorded: 12 },
      greens: { hit: 3, recorded: 17 },
    });
  });
  it("counts recorded zero penalties and excludes unplayed holes from totals", () => {
    const r = roundFixture();
    r.session.scorecardJson!.forEach((h) => (h.penalties = 0));
    r.session.scorecardJson![17].score = null;
    expect(summarizeTodayRound(r)).toMatchObject({ gross: 77, par: 66, penalties: 0, back: 33 });
  });
});
