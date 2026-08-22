import { describe, expect, it } from "vitest";

import {
  buildSpeedPrescription,
  calculateSpeedIndex,
  parseSpeedReadings,
  selectTrainingPeakReadings,
  summarizePhasedReadingsForPersistence,
  summarizeSessionSwings,
  summarizeSpeedReadings,
} from "@/lib/speed-training";

describe("speed training helpers", () => {
  it("parses pasted R-Speed readings without treating swing labels as speeds", () => {
    expect(
      parseSpeedReadings(`
        #15 84
        #14 86
        #13, 86
        swing 12: 87 mph
        19 should be ignored
      `),
    ).toEqual([84, 86, 86, 87]);
  });

  it("summarizes readings into min, average and max mph", () => {
    expect(summarizeSpeedReadings([73, 81, 76, 79, 87])).toEqual({
      count: 5,
      minSpeedMph: 73,
      avgSpeedMph: 79.2,
      maxSpeedMph: 87,
    });
  });

  it("keeps warm-up workload out of the persisted speed headline", () => {
    expect(
      summarizePhasedReadingsForPersistence([
        { phase: "warm_up", clubSpeedMph: 101 },
        { phase: "warm_up", clubSpeedMph: 99 },
        { phase: "max_speed", clubSpeedMph: 94 },
        { phase: "max_speed", clubSpeedMph: 96 },
      ]),
    ).toEqual({
      count: 4,
      minSpeedMph: 94,
      avgSpeedMph: 95,
      maxSpeedMph: 96,
    });
    expect(
      summarizePhasedReadingsForPersistence([
        { phase: "warm_up", clubSpeedMph: 101 },
        { phase: "warm_up", clubSpeedMph: 99 },
      ]),
    ).toBeNull();
  });

  it("keeps warm-up swings out of PB evidence while retaining legacy and summary-only data", () => {
    expect(
      selectTrainingPeakReadings(
        [
          { id: "phased", maxSpeedMph: 110 },
          { id: "legacy", maxSpeedMph: 98 },
          { id: "summary-only", maxSpeedMph: 97 },
          { id: "warmup-summary", maxSpeedMph: 94 },
        ],
        [
          { sessionId: "phased", phase: "warm_up", clubSpeedMph: 110 },
          { sessionId: "phased", phase: "max_speed", clubSpeedMph: 95 },
          { sessionId: "legacy", phase: null, clubSpeedMph: 96 },
          { sessionId: "warmup-summary", phase: "warm_up", clubSpeedMph: 105 },
        ],
      ),
    ).toEqual([95, 96, 97, 94]);
  });

  it("classifies speed index against the target", () => {
    expect(calculateSpeedIndex(90, 95)).toMatchObject({
      value: expect.closeTo(0.947, 3),
      label: "Developing",
      tone: "sky",
    });
    expect(calculateSpeedIndex(96, 95)).toMatchObject({
      label: "Target achieved",
      tone: "green",
    });
  });

  it("builds a speed prescription from current work and weekly volume", () => {
    expect(
      buildSpeedPrescription({
        currentSpeedMph: 90,
        targetSpeedMph: 95,
        thirtyDayAvgMph: 89,
        sessionsLast7Days: 0,
      }),
    ).toMatchObject({
      priority: "High",
      recommendation: "Add two short speed sessions, separated by at least a day.",
    });
  });

  it("summarizes speed session swing detail", () => {
    expect(summarizeSessionSwings([73, 81, 76, 79, 77, 84, 86, 87])).toMatchObject({
      swingCount: 8,
      bestSwingMph: 87,
      bestThreeAvgMph: 85.7,
      bestFiveAvgMph: 83.4,
      medianSpeedMph: 80,
      firstFiveAvgMph: 77.2,
      lastFiveAvgMph: 82.6,
      warmupGainMph: 5.4,
      fatigueDropMph: -5.4,
      trendLabel: "Built speed",
    });
  });
});
