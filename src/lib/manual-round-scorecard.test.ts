import { describe, expect, it } from "vitest";
import { manualRoundScorecard } from "./manual-round-scorecard";

const holes = [{ holeNumber: 1, par: 3, yards: 145, strokeIndex: 15 }];
function entries(score = "4") {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    holeCount: "1",
    "holeNumber-0": "1",
    "score-0": score,
    "par-0": "9",
    "yards-0": "999",
    "fairwayHit-0": "true",
  }))
    form.set(key, value);
  return form;
}

describe("manual round scorecard", () => {
  it("uses saved hole facts and never assigns fairway hit to a par three", () => {
    expect(manualRoundScorecard(entries(), holes, true)[0]).toMatchObject({
      par: 3,
      yards: 145,
      strokeIndex: 15,
      score: 4,
      fairwayHit: null,
      putts: null,
    });
  });
  it.each(["", "-1", "0", "3.5", "NaN", "Infinity"])(
    "rejects invalid completed score %s instead of coercing it",
    (score) => {
      expect(() => manualRoundScorecard(entries(score), holes, true)).toThrow("Hole 1");
    },
  );
  it("preserves unplayed scores and unknown stats in an active round", () => {
    expect(manualRoundScorecard(entries(""), holes, false)[0]).toMatchObject({
      score: null,
      penalties: null,
      gir: null,
    });
  });
  it("requires saved holes and rejects changed hole order or missing holes", () => {
    expect(() => manualRoundScorecard(entries(), [], true)).toThrow("saved hole-by-hole");
    const form = entries();
    form.set("holeCount", "2");
    expect(() => manualRoundScorecard(form, holes, true)).toThrow("scorecard changed");
    form.set("holeCount", "1");
    form.set("holeNumber-0", "9");
    expect(() => manualRoundScorecard(form, holes, true)).toThrow("hole order changed");
  });
  it("rejects invalid optional stats while keeping genuine zero values", () => {
    const form = entries();
    form.set("putts-0", "0");
    expect(manualRoundScorecard(form, holes, true)[0].putts).toBe(0);
    form.set("putts-0", "-1");
    expect(() => manualRoundScorecard(form, holes, true)).toThrow("putts");
  });
});
