import { describe, expect, it } from "vitest";
import { applyRoundHoleCorrection, roundPuttsAfterRecalculation } from "./round-hole-correction";

const hole = {
  holeNumber: 3,
  par: 3,
  score: 4,
  netScore: 3,
  chipShots: 1,
  notes: "Keep me",
  yards: 145,
};
function form(score = "5") {
  const data = new FormData();
  data.set("score", score);
  return data;
}
describe("round hole corrections", () => {
  it("preserves untouched metadata and optional fields while updating the net score delta", () => {
    expect(applyRoundHoleCorrection(hole, form(), true)).toMatchObject({
      score: 5,
      netScore: 4,
      chipShots: 1,
      notes: "Keep me",
      yards: 145,
      putts: null,
      penalties: null,
    });
  });
  it.each(["0", "-1", "3.5", "Infinity", "", "not a score"])(
    "rejects invalid completed score %s",
    (value) => {
      expect(() => applyRoundHoleCorrection(hole, form(value), true)).toThrow(
        "score must be a whole number",
      );
    },
  );
  it("accepts an unplayed hole on an unfinished round", () => {
    expect(applyRoundHoleCorrection(hole, form(""), false)).toMatchObject({
      score: null,
      netScore: null,
    });
  });
  it("keeps par-three fairways unavailable and rejects negative optional stats", () => {
    const data = form();
    data.set("fairwayHit", "true");
    data.set("putts", "0");
    expect(applyRoundHoleCorrection(hole, data, true)).toMatchObject({
      fairwayHit: null,
      putts: 0,
    });
    data.set("putts", "-1");
    expect(() => applyRoundHoleCorrection(hole, data, true)).toThrow("putts");
  });
  it("preserves manually corrected putts even when imported shot accounting differs", () => {
    const data = form("8");
    data.set("putts", "1");
    const corrected = applyRoundHoleCorrection(hole, data, true);
    expect(corrected.puttsSource).toBe("manual");
    expect(roundPuttsAfterRecalculation(corrected, 2)).toBe(1);
    expect(roundPuttsAfterRecalculation({ ...corrected, score: 9 }, 3)).toBe(1);
  });
  it("retains an explicit clearing as unrecorded while preserving legacy inference", () => {
    const data = form("8");
    data.set("putts", "");
    expect(roundPuttsAfterRecalculation(applyRoundHoleCorrection(hole, data, true), 2)).toBeNull();
    expect(roundPuttsAfterRecalculation({ score: 8, putts: 1, penalties: 0 }, 2)).toBe(6);
  });
});
