import { describe, expect, it } from "vitest";

import {
  calculateSessionLoad,
  calculateSessionModifier,
  calculateSessionVolume,
  calculateSessionVolumeBreakdown,
} from "@/lib/training/trainingLoad";

describe("golf training session load", () => {
  it("uses weighted swing breakdown before total swings", () => {
    expect(
      calculateSessionVolumeBreakdown({
        fullSwings: 40,
        shortGameSwings: 30,
        puttingSwings: 20,
        totalSwings: 200,
        rpe: 6,
      }),
    ).toEqual({
      baseVolume: 64,
      source: "swing_breakdown",
    });
  });

  it("falls back through total swings, minutes, holes, then manual volume", () => {
    expect(calculateSessionVolume({ totalSwings: 80, durationMinutes: 60, rpe: 4 })).toBe(80);
    expect(calculateSessionVolume({ durationMinutes: 75, holesPlayed: 18, rpe: 4 })).toBe(75);
    expect(calculateSessionVolume({ holesPlayed: 9, rpe: 4 })).toBe(60);
    expect(calculateSessionVolume({ holesPlayed: 18, rpe: 4 })).toBe(120);
    expect(calculateSessionVolume({ rpe: 4 })).toBe(30);
  });

  it("applies golf-specific load modifiers and rounds the final score", () => {
    const session = {
      holesPlayed: 18,
      walked: true,
      competition: true,
      mentalPressure: 8,
      rpe: 7,
    };

    expect(calculateSessionModifier(session)).toBeCloseTo(1.3, 3);
    expect(calculateSessionLoad(session)).toBe(1092);
  });
});
