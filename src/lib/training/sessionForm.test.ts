import { describe, expect, it } from "vitest";

import {
  aggregateSessionFormSnapshots,
  calculateSessionFormSignal,
} from "@/lib/training/sessionForm";

describe("latest session form signal", () => {
  it("nudges form up when the latest round is better than the previous round", () => {
    const signal = calculateSessionFormSignal(
      {
        kind: "round",
        title: "Latest round",
        sampleSize: 18,
        scoreToParPer18: 10,
      },
      {
        kind: "round",
        title: "Previous round",
        sampleSize: 18,
        scoreToParPer18: 14,
      },
    );

    expect(signal.direction).toBe("improving");
    expect(signal.adjustment).toBe(6);
    expect(signal.label).toBe("Golf Form improving");
  });

  it("nudges form down when shot quality goes backwards", () => {
    const signal = calculateSessionFormSignal(
      {
        kind: "shots",
        title: "Latest range",
        sampleSize: 25,
        averageOfflineYd: 22,
        playableRate: 58,
        carryAverageYd: 141,
        ballSpeedAverageMph: 101,
        carryStdDevYd: 14,
      },
      {
        kind: "shots",
        title: "Previous range",
        sampleSize: 25,
        averageOfflineYd: 16,
        playableRate: 72,
        carryAverageYd: 145,
        ballSpeedAverageMph: 104,
        carryStdDevYd: 10,
      },
    );

    expect(signal.direction).toBe("dipping");
    expect(signal.adjustment).toBeLessThan(0);
  });

  it("uses a low-confidence load fallback for manual sessions", () => {
    const signal = calculateSessionFormSignal(
      {
        kind: "load",
        title: "Latest manual",
        sampleSize: 1,
        sessionLoad: 60,
        rpe: 4,
      },
      {
        kind: "load",
        title: "Previous manual",
        sampleSize: 1,
        sessionLoad: 100,
        rpe: 4,
      },
    );

    expect(signal.direction).toBe("improving");
    expect(signal.confidence).toBe("low");
  });

  it("scores same-day launch monitor chunks as one practice day", () => {
    const latestPracticeDay = aggregateSessionFormSnapshots(
      [
        {
          kind: "shots",
          title: "Rapsodo practice",
          sampleSize: 26,
          averageOfflineYd: 10.9,
          playableRate: 100,
          carryAverageYd: 154,
          ballSpeedAverageMph: 107.7,
          carryStdDevYd: 40.6,
        },
        {
          kind: "shots",
          title: "Rapsodo practice",
          sampleSize: 6,
          averageOfflineYd: 11.6,
          playableRate: 100,
          carryAverageYd: 171.4,
          ballSpeedAverageMph: 120.4,
          carryStdDevYd: 25.7,
        },
        {
          kind: "shots",
          title: "Rapsodo practice",
          sampleSize: 9,
          averageOfflineYd: 12,
          playableRate: 100,
          carryAverageYd: 160.6,
          ballSpeedAverageMph: 110.8,
          carryStdDevYd: 41.3,
        },
      ],
      "3 practice blocks",
    );
    const previousPracticeDay = aggregateSessionFormSnapshots([
      {
        kind: "shots",
        title: "Rapsodo practice",
        sampleSize: 58,
        averageOfflineYd: 9.9,
        playableRate: 100,
        carryAverageYd: 123.5,
        ballSpeedAverageMph: 95.4,
        carryStdDevYd: 40.7,
      },
    ]);

    const signal = calculateSessionFormSignal(latestPracticeDay, previousPracticeDay);

    expect(signal.direction).toBe("improving");
    expect(signal.adjustment).toBeGreaterThan(0);
  });
});
