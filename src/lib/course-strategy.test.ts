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
    expect(strategy.hazardWarning).toContain("Bunker");
    expect(strategy.caveat).toContain("can change it");
  });
});
