import { describe, expect, it } from "vitest";

import {
  buildPostRoundReview,
  mergeStoredPostRoundReview,
  readStoredPostRoundReview,
} from "@/lib/post-round-review";

describe("post-round review", () => {
  it("does not use withheld direction as straight evidence or a practice recommendation", () => {
    const review = buildPostRoundReview({
      currentShots: Array.from({ length: 20 }, () => ({
        clubId: "driver",
        clubType: "driver",
        carryYd: 230,
        sideYd: null,
      })),
      baselineShots: shots("driver", "driver", [2, 3, 4]),
    });
    expect(review.strongest.value).toBe("No trusted club read");
    expect(review.practiceRecommendation.clubId).toBeNull();
    expect(review.biggestDifference.value).toBe("No same-club baseline");
  });
  it("returns deterministic strongest, costly and baseline-change reads", () => {
    const review = buildPostRoundReview({
      currentShots: [
        ...shots("pw", "pw", [2, -4, 6, 3]),
        ...shots("driver", "driver", [18, 22, -25, 20]),
      ],
      baselineShots: [
        ...shots("pw", "pw", [5, -6, 4]),
        ...shots("driver", "driver", [10, 12, -11, 9]),
      ],
    });

    expect(review.strongest.value).toBe("PW");
    expect(review.mostCostly.value).toBe("Driver");
    expect(review.biggestDifference.value).toContain("Driver +");
    expect(review.practiceRecommendation.clubId).toBe("driver");
  });

  it("requires three finite directional readings and labels missing evidence explicitly", () => {
    const review = buildPostRoundReview({
      currentShots: shots("driver", "driver", [2, 3, NaN, Infinity, -Infinity]),
      baselineShots: [],
    });
    expect(review.sampleSize).toBe(0);
    expect(review.strongest.status).toBe("Needs evidence");
    expect(review.mostCostly.status).toBe("Needs evidence");
    expect(review.practiceRecommendation.clubType).toBeNull();
  });

  it("does not call an unchanged lateral miss tighter or claim matched conditions", () => {
    const review = buildPostRoundReview({
      currentShots: shots("driver", "driver", [10, -12, 14]),
      baselineShots: shots("driver", "driver", [10, 12, -14]),
    });
    expect(review.biggestDifference.value).toBe("Driver 0 yd");
    expect(review.biggestDifference.status).toBe("Compared");
    expect(review.biggestDifference.detail).toContain("Unchanged to 0.1 yd");
    expect(review.biggestDifference.detail).toContain("Conditions and shot intent may differ");
    expect(review.practiceRecommendation.status).toBe("Suggested");
    expect(review.practiceRecommendation.clubType).toBe("driver");
  });

  it("keeps tied results stable when input order changes", () => {
    const a = shots("a", "pw", [3, 4, 5]);
    const b = shots("b", "driver", [3, 4, 5]);
    expect(buildPostRoundReview({ currentShots: [...a, ...b], baselineShots: [] })).toEqual(
      buildPostRoundReview({ currentShots: [...b, ...a], baselineShots: [] }),
    );
  });

  it("preserves ordinary notes while replacing the structured review block", () => {
    const first = mergeStoredPostRoundReview("Existing round note", {
      feltDifferent: "Tempo settled",
      troubleClub: "Driver",
      contextChange: "Wet ground",
      shotsToReview: "12 and 15",
    });
    const second = mergeStoredPostRoundReview(first, {
      feltDifferent: "Tempo improved",
      troubleClub: "7i",
      contextChange: "Wind rose",
      shotsToReview: "8",
    });

    expect(second).toContain("Existing round note");
    expect(second.match(/LMWT_POST_ROUND_REVIEW/g)).toHaveLength(2);
    expect(readStoredPostRoundReview(second).troubleClub).toBe("7i");
  });
});

function shots(clubId: string, clubType: string, sides: number[]) {
  return sides.map((sideYd) => ({ clubId, clubType, sideYd, carryYd: 150 }));
}
