import { describe, expect, it } from "vitest";
import { buildRoundLearningReview } from "./round-learning-review";

const card = (scores: (number | null)[]) =>
  scores.map((score, index) => ({ holeNumber: index + 1, par: 4, score }));

describe("round learning from scorecards", () => {
  it("does not invent a costly hole or corrective drill on an all-par card", () => {
    const review = buildRoundLearningReview({ holes: card(Array(18).fill(4)) });
    expect(review.strongestArea).toBe("18 holes at par");
    expect(review.costliestArea).toBe("No scored holes over par");
    expect(review.scorePattern).toContain("18/18 holes scored");
    expect(review.nextPractice).toBe("Record what worked and any decisions to practise next");
  });
  it("shows ties and compares with par without claiming a turning point", () => {
    const review = buildRoundLearningReview({ holes: card([3, 6, 4, 6, null]) });
    expect(review.strongestArea).toBe("Hole 1 · -1 vs par");
    expect(review.costliestArea).toBe("Holes 2, 4 · +2 vs par");
    expect(review.scorePattern).toBe("4/5 holes scored · 1 under par · 1 par · 2 over par");
    expect(review.nextPractice).toContain("Add notes");
  });
  it("keeps missing evidence explicit and excludes unplayed hole defaults", () => {
    const review = buildRoundLearningReview({
      holes: card([null, null, null]).map((hole) => ({
        ...hole,
        gir: false,
        putts: 3,
        penalties: 2,
      })),
    });
    expect(review.costliestArea).toBe("No scored holes yet");
    expect(review.nextPractice).toContain("Add hole scores");
    expect(review.strategyResult).toContain("not recorded");
  });
  it("uses the recorded putting sample rather than dividing by all scheduled holes", () => {
    const holes = card(Array(18).fill(4)).map((hole, index) => ({
      ...hole,
      putts: index < 3 ? 3 : null,
    }));
    expect(buildRoundLearningReview({ holes }).nextPractice).toBe(
      "Check putting pace: 9 putts across 3 recorded holes",
    );
  });
  it("does not turn one missed green into an approach prescription", () => {
    const holes = card([4, 4, 4]).map((hole, index) => ({
      ...hole,
      gir: index === 0 ? false : undefined,
    }));
    const review = buildRoundLearningReview({ holes });
    expect(review.strategyResult).toContain("0/1 recorded greens hit");
    expect(review.nextPractice).not.toContain("approach");
  });
});
