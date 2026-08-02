import { describe, expect, it } from "vitest";

import { detectShotDataIntegrityIssue } from "@/lib/shot-data-integrity";

describe("shot data integrity", () => {
  it("holds a low-flight, high-rollout full wedge row for review", () => {
    expect(
      detectShotDataIntegrityIssue({
        clubType: "sw",
        shotCategory: "full",
        carryYd: 36.1,
        totalYd: 86.4,
        launchAngleDeg: 3.1,
        apexFt: 2.1,
      }),
    ).toBe("trajectory-review");
  });

  it("keeps a normal full wedge shot and a low running chip out of the review queue", () => {
    expect(
      detectShotDataIntegrityIssue({
        clubType: "sw",
        shotCategory: "full",
        carryYd: 89.7,
        totalYd: 91.9,
        launchAngleDeg: 46.8,
        apexFt: 97.7,
      }),
    ).toBeNull();
    expect(
      detectShotDataIntegrityIssue({
        clubType: "sw",
        shotCategory: "chip",
        carryYd: 18,
        totalYd: 42,
        launchAngleDeg: 5,
        apexFt: 4,
      }),
    ).toBeNull();
  });
});
