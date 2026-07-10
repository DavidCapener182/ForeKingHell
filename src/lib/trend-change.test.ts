import { describe, expect, it } from "vitest";

import { detectTrendChanges, type TrendShot } from "@/lib/trend-change";

describe("detectTrendChanges", () => {
  it("detects a distance-versus-dispersion trade-off", () => {
    const changes = detectTrendChanges(
      shots(150, [-3, -2, -1, 1, 2, 3]),
      shots(158, [-15, -10, -5, 5, 10, 15]),
    );
    expect(changes[0]?.headline).toContain("Carry increased");
    expect(changes[0]?.evidence).toContain("+8 yd");
  });

  it("does not call a tiny sample a trend", () => {
    expect(detectTrendChanges(shots(150, [0, 1]), shots(160, [0, 1]))).toEqual([]);
  });
});

function shots(carry: number, sides: number[]): TrendShot[] {
  return sides.map((sideYd, index) => ({
    carryYd: carry + (index % 2),
    sideYd,
    ballSpeedMph: 110,
    smashFactor: 1.4,
  }));
}
