import { describe, expect, it } from "vitest";
import { buildLiveRoundClubEvidence } from "./live-round-club-evidence";

const strategy = {
  holeNumber: 1,
  personalCarryYd: 190,
  recommendedClub: "5W",
  followUpClubs: [{ label: "7i", expectedCarryRange: "145–155 yd" }],
};
const shot = (
  clubType: string,
  shotNumber: number | null,
  courseHoleShotNumber: number | null,
  courseHoleNumber = 1,
) => ({ clubType, shotNumber, courseHoleShotNumber, courseHoleNumber });

describe("live round club evidence", () => {
  it("keeps linked hole shots in one consistent order without changing the input", () => {
    const shots = [shot("pw", 12, 2), shot("driver", 11, 1), shot("7i", 2, 1, 2)];
    const evidence = buildLiveRoundClubEvidence([strategy], shots)[1];
    expect(evidence.plan).toEqual(["5W", "7i"]);
    expect(evidence.actual).toHaveLength(2);
    expect(evidence.actual[0]).toBe("Driver");
    expect(evidence.actualOrderKnown).toBe(true);
    expect(shots[0].shotNumber).toBe(12);
  });
  it("falls back to global order for all shots instead of mixing numbering systems", () => {
    const evidence = buildLiveRoundClubEvidence(
      [strategy],
      [shot("pw", 12, 2), shot("driver", 11, null)],
    )[1];
    expect(evidence.actual[0]).toBe("Driver");
    expect(evidence.actualOrderKnown).toBe(true);
  });
  it("labels missing ordering evidence and never derives clubs from a scorecard", () => {
    expect(
      buildLiveRoundClubEvidence([strategy], [shot("driver", null, null)])[1].actualOrderKnown,
    ).toBe(false);
    expect(buildLiveRoundClubEvidence([strategy], [])[1].actual).toEqual([]);
  });
  it("does not present a plan without personal carry evidence", () => {
    expect(buildLiveRoundClubEvidence([{ ...strategy, personalCarryYd: null }], [])).toEqual({});
  });
});
