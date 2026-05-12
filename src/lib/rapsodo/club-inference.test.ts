import { describe, expect, it } from "vitest";

import {
  suggestRapsodoClub,
  type RapsodoClubChoice,
} from "@/lib/rapsodo/club-inference";
import { parseRapsodoCsv } from "@/lib/rapsodo/parser";

describe("suggestRapsodoClub", () => {
  it("trusts a tracked Rapsodo club when stock yardage does not clearly contradict it", () => {
    const suggestion = suggestRapsodoClub(
      shot("Driver", 241, 265, 151),
      [
        club("driver", "Driver", 240, 265, 151, 24),
        club("7i", "7 Iron", 150, 160, 112, 24),
      ],
    );

    expect(suggestion.choice.clubType).toBe("driver");
    expect(suggestion.confidence).toBe("trusted");
    expect(suggestion.reason).toContain("reported club matches");
  });

  it("infers an unknown Rapsodo club from closest stock yardage", () => {
    const suggestion = suggestRapsodoClub(
      shot("Other", 151, 161, 113),
      [
        club("driver", "Driver", 240, 265, 151, 24),
        club("7i", "7 Iron", 150, 160, 112, 24),
      ],
    );

    expect(suggestion.choice.clubType).toBe("7i");
    expect(suggestion.confidenceScore).toBeGreaterThanOrEqual(78);
    expect(suggestion.reason).toContain("closest match");
  });

  it("overrides a tracked club when another bag club is materially closer", () => {
    const suggestion = suggestRapsodoClub(
      shot("Driver", 152, 162, 113),
      [
        club("driver", "Driver", 240, 265, 151, 24),
        club("7i", "7 Iron", 150, 160, 112, 24),
      ],
    );

    expect(suggestion.choice.clubType).toBe("7i");
    expect(suggestion.reason).toContain("materially closer");
    expect(suggestion.alternatives[0]).toMatchObject({ clubLabel: "7 Iron" });
  });

  it("falls back to low confidence when there is no stock-yardage candidate", () => {
    const suggestion = suggestRapsodoClub(shot("Other", 151, 161, 113), []);

    expect(suggestion.choice.clubType).toBe("other");
    expect(suggestion.confidence).toBe("low");
    expect(suggestion.reason).toContain("choose the club");
  });
});

function club(
  clubType: string,
  clubLabel: string,
  stockCarryYd: number,
  stockTotalYd: number,
  averageBallSpeedMph: number,
  sampleSize: number,
): RapsodoClubChoice {
  return {
    clubKey: `${clubType}:generic:generic`,
    clubType,
    clubLabel,
    clubBrand: null,
    clubModel: null,
    stockCarryYd,
    stockTotalYd,
    averageBallSpeedMph,
    sampleSize,
  };
}

function shot(clubType: string, carryYd: number, totalYd: number, ballSpeedMph: number) {
  return parseRapsodoCsv(
    [
      "Club Type,Carry Distance (yd),Total Distance (yd),Ball Speed",
      `${clubType},${carryYd},${totalYd},${ballSpeedMph}`,
    ].join("\n"),
  ).shots[0];
}
