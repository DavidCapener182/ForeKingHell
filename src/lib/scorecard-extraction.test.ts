import { describe, expect, it } from "vitest";

import { normalizeExtractedScorecard } from "@/lib/scorecard-extraction";

describe("normalizeExtractedScorecard", () => {
  it("normalizes an 18Birdies-style scorecard payload", () => {
    const scorecard = normalizeExtractedScorecard({
      courseName: " TPC Sawgrass (Stadium) ",
      dateIso: "08/05/2026",
      teeName: "White",
      totalYards: "6086",
      courseRating: "70.8",
      slopeRating: "138.0",
      totalScore: "94",
      holes: [
        {
          holeNumber: "1",
          par: "4",
          strokeIndex: "11",
          score: "5",
          netScore: "4",
          fairwayHit: "check",
          gir: "x",
          putts: "2",
        },
      ],
    });

    expect(scorecard.courseName).toBe("TPC Sawgrass (Stadium)");
    expect(scorecard.dateIso).toBe("2026-05-08");
    expect(scorecard.totalYards).toBe(6086);
    expect(scorecard.courseRating).toBe(70.8);
    expect(scorecard.slopeRating).toBe(138);
    expect(scorecard.holes[0]).toMatchObject({
      holeNumber: 1,
      par: 4,
      strokeIndex: 11,
      score: 5,
      netScore: 4,
      fairwayHit: true,
      gir: false,
      putts: 2,
    });
  });
});
