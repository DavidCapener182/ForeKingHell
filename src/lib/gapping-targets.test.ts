import { describe, expect, it } from "vitest";

import { buildPersonalGappingTargets, type PersonalGappingInput } from "@/lib/gapping-targets";

function club(
  input: Partial<PersonalGappingInput> & Pick<PersonalGappingInput, "clubType" | "carryYd">,
): PersonalGappingInput {
  return {
    sampleSize: 24,
    confidenceScore: 68,
    decisionLabel: "Developing",
    ...input,
  };
}

describe("personal gapping targets", () => {
  it("caps next-step targets for a mid-handicap bag instead of chasing ideal distances", () => {
    const rows = buildPersonalGappingTargets(
      [
        club({ clubType: "driver", carryYd: 205, confidenceScore: 86, decisionLabel: "Trust" }),
        club({ clubType: "5w", carryYd: 178 }),
        club({ clubType: "5i", carryYd: 159 }),
        club({ clubType: "6i", carryYd: 152 }),
        club({ clubType: "7i", carryYd: 141 }),
        club({ clubType: "8i", carryYd: 134, confidenceScore: 84, decisionLabel: "Trust" }),
        club({ clubType: "9i", carryYd: 127, confidenceScore: 84, decisionLabel: "Trust" }),
        club({ clubType: "pw", carryYd: 108, confidenceScore: 84, decisionLabel: "Trust" }),
      ],
      { handicapBand: "15-18" },
    );

    const byClub = new Map(rows.map((row) => [row.clubType, row]));

    expect(byClub.get("driver")?.targetCarryYd).toBe(205);
    expect(byClub.get("5w")?.workOnYd).toBeLessThanOrEqual(6);
    expect(byClub.get("5i")?.workOnYd).toBeLessThanOrEqual(5);
    expect(byClub.get("6i")?.workOnYd).toBeGreaterThanOrEqual(3);
    expect(byClub.get("6i")?.workOnYd).toBeLessThanOrEqual(5);
    expect(byClub.get("9i")?.targetCarryYd).toBe(127);
    expect(byClub.get("pw")?.targetCarryYd).toBe(108);
  });

  it("never creates a negative work-on target for a club that out-carries the ladder", () => {
    const rows = buildPersonalGappingTargets(
      [
        club({ clubType: "7i", carryYd: 145, confidenceScore: 82, decisionLabel: "Trust" }),
        club({ clubType: "8i", carryYd: 139, confidenceScore: 82, decisionLabel: "Trust" }),
        club({ clubType: "9i", carryYd: 142, confidenceScore: 82, decisionLabel: "Trust" }),
        club({ clubType: "pw", carryYd: 110, confidenceScore: 82, decisionLabel: "Trust" }),
      ],
      { handicapBand: "18" },
    );

    const nineIron = rows.find((row) => row.clubType === "9i");

    expect(nineIron?.targetCarryYd).toBeGreaterThanOrEqual(142);
    expect(nineIron?.workOnYd).toBeGreaterThanOrEqual(0);
    expect(nineIron?.targetMessage).not.toMatch(/take off/i);
  });

  it("uses recommended gapping carries when they differ from best stock", () => {
    const rows = buildPersonalGappingTargets([
      club({
        clubType: "5i",
        carryYd: 164.1,
        gappingCarryYd: 160,
        confidenceScore: 84,
        decisionLabel: "Trust",
      }),
      club({
        clubType: "6i",
        carryYd: 159.7,
        gappingCarryYd: 148,
        confidenceScore: 84,
        decisionLabel: "Trust",
      }),
      club({
        clubType: "7i",
        carryYd: 154.3,
        gappingCarryYd: 136,
        confidenceScore: 84,
        decisionLabel: "Trust",
      }),
    ]);

    const sixIron = rows.find((row) => row.clubType === "6i");

    expect(sixIron?.targetCarryYd).toBe(148);
    expect(sixIron?.workOnYd).toBe(0);
    expect(sixIron?.targetMessage).toBe("Distance healthy - focus consistency");
  });

  it("keeps trusted scoring clubs focused on consistency", () => {
    const rows = buildPersonalGappingTargets(
      [
        club({ clubType: "8i", carryYd: 136, confidenceScore: 88, decisionLabel: "Trust" }),
        club({ clubType: "9i", carryYd: 128, confidenceScore: 88, decisionLabel: "Trust" }),
        club({ clubType: "pw", carryYd: 110, confidenceScore: 88, decisionLabel: "Trust" }),
      ],
      { handicapBand: "10-14" },
    );

    const nineIron = rows.find((row) => row.clubType === "9i");
    const pitchingWedge = rows.find((row) => row.clubType === "pw");

    expect(nineIron?.targetCarryYd).toBe(128);
    expect(pitchingWedge?.targetCarryYd).toBe(110);
    expect(pitchingWedge?.targetMessage).toBe("Distance healthy - focus consistency");
  });

  it("uses launch and strike messaging instead of distance when the sample is not trusted", () => {
    const rows = buildPersonalGappingTargets([
      club({ clubType: "5i", carryYd: 160, averageLaunchAngleDeg: 7 }),
      club({
        clubType: "6i",
        carryYd: 151,
        averageLaunchAngleDeg: 8,
        sampleSize: 4,
        confidenceScore: 24,
        decisionLabel: "Do not trust yet",
      }),
    ]);

    expect(rows[0].targetMessage).toBe("Launch window opportunity");
    expect(rows[1].targetCarryYd).toBe(151);
    expect(rows[1].targetMessage).toBe("Build reliable sample first");
  });
});
