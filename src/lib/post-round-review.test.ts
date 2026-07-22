import { describe, expect, it } from "vitest";

import {
  buildPostRoundReview,
  mergeStoredPostRoundReview,
  readStoredPostRoundReview,
} from "@/lib/post-round-review";

describe("post-round review", () => {
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
