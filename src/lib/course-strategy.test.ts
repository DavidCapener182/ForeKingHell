import { describe, expect, it } from "vitest";

import { buildHoleStrategies } from "@/lib/course-strategy";

describe("course strategy", () => {
  it("combines bag ranges, misses and mapped hazards without claiming certainty", () => {
    const [strategy] = buildHoleStrategies({
      holes: [{ holeNumber: 7, par: 4, yards: 382 }],
      clubs: [
        {
          clubId: "driver",
          label: "Driver",
          carryYd: 245,
          minCarryYd: 230,
          maxCarryYd: 260,
          leftYd: 16,
          rightYd: 28,
          confidence: 0.8,
          sampleSize: 30,
        },
        {
          clubId: "3w",
          label: "3 Wood",
          carryYd: 220,
          minCarryYd: 208,
          maxCarryYd: 232,
          leftYd: 12,
          rightYd: 15,
          confidence: 0.75,
          sampleSize: 22,
        },
      ],
      hazardsByHole: new Map([[7, ["bunker"]]]),
    });
    expect(strategy.recommendedClub).toBe("3 Wood");
    expect(strategy.safeTarget).toBe("Left-centre");
    expect(strategy.personalCarryYd).toBe(220);
    expect(strategy.dispersionLeftYd).toBe(12);
    expect(strategy.dispersionRightYd).toBe(15);
    expect(strategy.hazards).toEqual(["Bunker"]);
    expect(strategy.hazardWarning).toContain("Bunker");
    expect(strategy.strategyModes.map((mode) => mode.id)).toEqual(["normal", "aggressive"]);
    expect(strategy.caveat).toContain("can change it");
  });

  it("uses Driver only for the opening shot and splits a par-5 leave across non-driver clubs", () => {
    const [strategy] = buildHoleStrategies({
      holes: [{ holeNumber: 1, par: 5, yards: 547 }],
      clubs: [
        {
          clubId: "driver",
          label: "Driver",
          carryYd: 200,
          minCarryYd: 189,
          maxCarryYd: 211,
          leftYd: 12,
          rightYd: 18,
          confidence: 0.82,
          sampleSize: 47,
        },
        {
          clubId: "5w",
          label: "5W",
          carryYd: 175,
          minCarryYd: 171,
          maxCarryYd: 178,
          leftYd: 8,
          rightYd: 9,
          confidence: 0.76,
          sampleSize: 25,
        },
        {
          clubId: "6i",
          label: "6 Iron",
          carryYd: 150,
          minCarryYd: 147,
          maxCarryYd: 153,
          leftYd: 7,
          rightYd: 8,
          confidence: 0.75,
          sampleSize: 20,
        },
      ],
      hazardsByHole: new Map(),
    });

    expect(strategy.expectedLeaveYd).toBe(347);
    expect(strategy.expectedLeave).toBe("347 yd after the first shot");
    expect(strategy.followUpClubs).toEqual([
      {
        label: "5W",
        expectedCarryRange: "171–178 yd",
      },
      {
        label: "6 Iron",
        expectedCarryRange: "147–153 yd",
      },
    ]);
    expect(strategy.followUpClubs.some((club) => club.label.toLowerCase() === "driver")).toBe(
      false,
    );
    expect(strategy.followUpFit).toBe("Closest measured sequence");
  });

  it("excludes every Driver variant from follow-up shots", () => {
    const [strategy] = buildHoleStrategies({
      holes: [{ holeNumber: 3, par: 4, yards: 388 }],
      clubs: [
        {
          clubId: "driver-primary",
          label: "Driver",
          carryYd: 200,
          minCarryYd: 189,
          maxCarryYd: 211,
          leftYd: 12,
          rightYd: 18,
          confidence: 0.82,
          sampleSize: 47,
        },
        {
          clubId: "driver-secondary",
          label: "DRIVER",
          carryYd: 195,
          minCarryYd: 183,
          maxCarryYd: 207,
          leftYd: 11,
          rightYd: 17,
          confidence: 0.79,
          sampleSize: 41,
        },
        {
          clubId: "5w",
          label: "5W",
          carryYd: 175,
          minCarryYd: 171,
          maxCarryYd: 178,
          leftYd: 8,
          rightYd: 9,
          confidence: 0.76,
          sampleSize: 25,
        },
      ],
      hazardsByHole: new Map(),
    });

    expect(strategy.expectedLeaveYd).toBe(188);
    expect(strategy.followUpClubs).toEqual([
      {
        label: "5W",
        expectedCarryRange: "171–178 yd",
      },
    ]);
    expect(strategy.followUpClubs.some((club) => club.label.toLowerCase() === "driver")).toBe(
      false,
    );
    expect(strategy.followUpFit).toBe("Closest measured sequence");
  });

  it("builds a two-club sequence when no single club covers the leave", () => {
    const [strategy] = buildHoleStrategies({
      holes: [{ holeNumber: 3, par: 4, yards: 450 }],
      clubs: [
        {
          clubId: "driver",
          label: "Driver",
          carryYd: 200,
          minCarryYd: 189,
          maxCarryYd: 211,
          leftYd: 12,
          rightYd: 18,
          confidence: 0.82,
          sampleSize: 47,
        },
        {
          clubId: "5i",
          label: "5 Iron",
          carryYd: 154,
          minCarryYd: 149,
          maxCarryYd: 155,
          leftYd: 8,
          rightYd: 10,
          confidence: 0.72,
          sampleSize: 18,
        },
        {
          clubId: "pw",
          label: "Pitching Wedge",
          carryYd: 96,
          minCarryYd: 90,
          maxCarryYd: 102,
          leftYd: 6,
          rightYd: 7,
          confidence: 0.78,
          sampleSize: 24,
        },
        {
          clubId: "9i",
          label: "9 Iron",
          carryYd: 125,
          minCarryYd: 123,
          maxCarryYd: 127,
          leftYd: 6,
          rightYd: 7,
          confidence: 0.78,
          sampleSize: 24,
        },
      ],
      hazardsByHole: new Map(),
    });

    expect(strategy.expectedLeaveYd).toBe(250);
    expect(strategy.followUpClubs).toEqual([
      {
        label: "5 Iron",
        expectedCarryRange: "149–155 yd",
      },
      {
        label: "Pitching Wedge",
        expectedCarryRange: "90–102 yd",
      },
    ]);
    expect(strategy.followUpFit).toBe("In measured range");
  });

  it("splits every leave over 200 yards even when one non-driver range could reach it", () => {
    const [strategy] = buildHoleStrategies({
      holes: [{ holeNumber: 8, par: 4, yards: 425 }],
      clubs: [
        {
          clubId: "driver",
          label: "Driver",
          carryYd: 220,
          minCarryYd: 210,
          maxCarryYd: 230,
          leftYd: 12,
          rightYd: 18,
          confidence: 0.82,
          sampleSize: 47,
        },
        {
          clubId: "3w",
          label: "3W",
          carryYd: 205,
          minCarryYd: 200,
          maxCarryYd: 210,
          leftYd: 10,
          rightYd: 12,
          confidence: 0.79,
          sampleSize: 30,
        },
        {
          clubId: "9i",
          label: "9i",
          carryYd: 125,
          minCarryYd: 123,
          maxCarryYd: 127,
          leftYd: 6,
          rightYd: 7,
          confidence: 0.78,
          sampleSize: 24,
        },
        {
          clubId: "pw",
          label: "PW",
          carryYd: 80,
          minCarryYd: 75,
          maxCarryYd: 82,
          leftYd: 5,
          rightYd: 6,
          confidence: 0.77,
          sampleSize: 22,
        },
      ],
      hazardsByHole: new Map(),
    });

    expect(strategy.expectedLeaveYd).toBe(205);
    expect(strategy.followUpClubs.map((club) => club.label)).toEqual(["9i", "PW"]);
    expect(strategy.followUpClubs.map((club) => club.label)).not.toContain("3W");
    expect(strategy.followUpFit).toBe("In measured range");
  });
});
