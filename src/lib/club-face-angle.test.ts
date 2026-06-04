import { describe, expect, it } from "vitest";

import {
  calculateClubFaceAngleDeg,
  calculateFaceToPathDeg,
  resolveClubFaceAngleDeg,
} from "@/lib/club-face-angle";

describe("club face angle calculations", () => {
  it("derives face angle from launch direction and club path using the 80/20 wood formula", () => {
    expect(calculateClubFaceAngleDeg(-5.6, -5.9)).toBe(-5.5);
  });

  it("prefers a measured face angle over a derived value", () => {
    expect(
      resolveClubFaceAngleDeg({
        faceAngleDeg: -4.8,
        launchDirectionDeg: -5.6,
        clubPathDeg: -5.9,
      }),
    ).toBe(-4.8);
  });

  it("calculates face to path from the resolved face angle", () => {
    expect(calculateFaceToPathDeg({ launchDirectionDeg: -5.6, clubPathDeg: -5.9 })).toBe(0.4);
  });
});
