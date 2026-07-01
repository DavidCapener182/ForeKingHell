import { describe, expect, it } from "vitest";

import {
  bigMissOfflineLimitYd,
  clubTypeCurrentPerformanceScore,
  clubTypeEstimatedStrokeEffect,
  clubTypeImprovementScore,
} from "@/lib/today-club-scoring";

describe("today club scoring", () => {
  it("keeps straight-shot percentage low-weighted for driver and high-weighted for wedges", () => {
    const controlledDriver = clubTypeCurrentPerformanceScore("driver", {
      shotCount: 20,
      playableRate: 100,
      bigMissRate: 0,
      offlineAverageYd: 18,
      straightRate: 80,
      carryStdDevYd: 12,
    });
    const crookedDriver = clubTypeCurrentPerformanceScore("driver", {
      shotCount: 20,
      playableRate: 100,
      bigMissRate: 0,
      offlineAverageYd: 18,
      straightRate: 8,
      carryStdDevYd: 12,
    });
    const controlledWedge = clubTypeCurrentPerformanceScore("gw", {
      shotCount: 8,
      playableRate: 100,
      bigMissRate: 0,
      offlineAverageYd: 6,
      straightRate: 80,
      carryStdDevYd: 4,
    });
    const crookedWedge = clubTypeCurrentPerformanceScore("gw", {
      shotCount: 8,
      playableRate: 100,
      bigMissRate: 0,
      offlineAverageYd: 6,
      straightRate: 8,
      carryStdDevYd: 4,
    });

    expect(controlledDriver - crookedDriver).toBeLessThan(5);
    expect(controlledWedge - crookedWedge).toBeGreaterThan(20);
  });

  it("does not turn a playable driver block into a severe negative only because straight rate fell", () => {
    const driverScore = clubTypeImprovementScore("driver", {
      playableRateDelta: 0,
      bigMissRateDelta: 0,
      offlineDeltaYd: 2,
      carryDeltaYd: -7,
      straightRateDelta: -42,
      consistencyDeltaYd: 1,
    });
    const wedgeScore = clubTypeImprovementScore("gw", {
      playableRateDelta: 0,
      bigMissRateDelta: 0,
      offlineDeltaYd: 2,
      carryDeltaYd: -7,
      straightRateDelta: -42,
      consistencyDeltaYd: 1,
    });

    expect(driverScore).toBeGreaterThan(wedgeScore);
    expect(driverScore).toBeGreaterThan(-1.2);
  });

  it("uses big-miss avoidance as a distinct driver input", () => {
    const cleanDriverEffect = clubTypeEstimatedStrokeEffect("driver", {
      playableRateDelta: 0,
      bigMissRateDelta: -20,
      offlineDeltaYd: 0,
      carryDeltaYd: 0,
      straightRateDelta: 0,
      consistencyDeltaYd: 0,
    });
    const looseDriverEffect = clubTypeEstimatedStrokeEffect("driver", {
      playableRateDelta: 0,
      bigMissRateDelta: 20,
      offlineDeltaYd: 0,
      carryDeltaYd: 0,
      straightRateDelta: 0,
      consistencyDeltaYd: 0,
    });

    expect(bigMissOfflineLimitYd("driver")).toBeGreaterThan(bigMissOfflineLimitYd("7i"));
    expect(cleanDriverEffect).toBeGreaterThan(0);
    expect(looseDriverEffect).toBeLessThan(0);
  });
});
