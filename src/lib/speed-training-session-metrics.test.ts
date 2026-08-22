import { describe, expect, it } from "vitest";

import {
  evaluateFiveShotTransferPlayability,
  summarizePhasedSpeedSession,
  summarizeRepeatedSpeedPeak,
  summarizeSpeedSessionMetrics,
  type LinkedSpeedTransferEvidence,
} from "@/lib/speed-training";

describe("speed training session metrics", () => {
  it("calculates an odd-sample median separately from top averages and session best", () => {
    expect(summarizeSpeedSessionMetrics([80, 86, 82, 84, 88])).toEqual({
      swingCount: 5,
      medianSpeedMph: 84,
      topThreeAvgMph: 86,
      topFiveAvgMph: 84,
      sessionBestMph: 88,
    });
  });

  it("calculates an even-sample median from the middle pair", () => {
    expect(summarizeSpeedSessionMetrics([80, 82, 84, 88])).toEqual({
      swingCount: 4,
      medianSpeedMph: 83,
      topThreeAvgMph: 84.7,
      topFiveAvgMph: null,
      sessionBestMph: 88,
    });
  });

  it("does not mislabel fewer than three or five swings as a top-N average", () => {
    expect(summarizeSpeedSessionMetrics([88, 86])).toEqual({
      swingCount: 2,
      medianSpeedMph: 87,
      topThreeAvgMph: null,
      topFiveAvgMph: null,
      sessionBestMph: 88,
    });

    expect(summarizeSpeedSessionMetrics([88, 86, 84])).toMatchObject({
      topThreeAvgMph: 86,
      topFiveAvgMph: null,
    });
  });

  it("preserves warm-up, maximum-speed and transfer phase summaries", () => {
    const summary = summarizePhasedSpeedSession([
      { phase: "warm_up", clubSpeedMph: 80 },
      { phase: "warm_up", clubSpeedMph: 82 },
      { phase: "max_speed", clubSpeedMph: 88 },
      { phase: "max_speed", clubSpeedMph: 90 },
      { phase: "max_speed", clubSpeedMph: 92 },
      { phase: "transfer", clubSpeedMph: 86 },
      { phase: "transfer", clubSpeedMph: 87 },
    ]);

    expect(summary.overall).toMatchObject({
      swingCount: 7,
      medianSpeedMph: 87,
      sessionBestMph: 92,
    });
    expect(summary.phases.warm_up).toMatchObject({
      phase: "warm_up",
      swingCount: 2,
      medianSpeedMph: 81,
    });
    expect(summary.phases.max_speed).toMatchObject({
      phase: "max_speed",
      swingCount: 3,
      topThreeAvgMph: 90,
      sessionBestMph: 92,
    });
    expect(summary.phases.transfer).toMatchObject({
      phase: "transfer",
      swingCount: 2,
      medianSpeedMph: 86.5,
    });
  });
});

describe("repeated speed peak trust", () => {
  it("keeps a one-off maximum unverified until another swing repeats it", () => {
    expect(summarizeRepeatedSpeedPeak([79, 81, 82, 87])).toEqual({
      trustedPeakMph: 82,
      trustedEvidenceCount: 2,
      readingCount: 4,
      unverifiedPeakMph: 87,
    });

    expect(summarizeRepeatedSpeedPeak([79, 81, 86.2, 87])).toEqual({
      trustedPeakMph: 87,
      trustedEvidenceCount: 2,
      readingCount: 4,
      unverifiedPeakMph: null,
    });
  });
});

describe("five-shot speed transfer playability", () => {
  it("passes and retains its explicit session link when four of five finish in corridor", () => {
    expect(evaluateFiveShotTransferPlayability(transferEvidence([-8, 0, 10, 5, 12]))).toEqual({
      speedSessionId: "speed-session-1",
      transferSessionId: "transfer-session-1",
      requiredShotCount: 5,
      requiredInCorridorCount: 4,
      evaluatedShotIds: ["shot-1", "shot-2", "shot-3", "shot-4", "shot-5"],
      measuredShotCount: 5,
      inCorridorCount: 4,
      playabilityPercent: 80,
      status: "passed",
      isPlayable: true,
    });
  });

  it("fails when only three of five finish in corridor", () => {
    expect(
      evaluateFiveShotTransferPlayability(transferEvidence([-8, 0, 10, 12, 13])),
    ).toMatchObject({
      measuredShotCount: 5,
      inCorridorCount: 3,
      playabilityPercent: 60,
      status: "failed",
      isPlayable: false,
    });
  });

  it("stays incomplete until all five transfer shots have corridor measurements", () => {
    const evidence = transferEvidence([-8, 0, 5, 7]);

    expect(evaluateFiveShotTransferPlayability(evidence)).toMatchObject({
      measuredShotCount: 4,
      inCorridorCount: 4,
      playabilityPercent: null,
      status: "incomplete",
      isPlayable: null,
    });
  });
});

function transferEvidence(sideCarryValues: Array<number | null>): LinkedSpeedTransferEvidence {
  return {
    speedSessionId: "speed-session-1",
    transferSessionId: "transfer-session-1",
    personalCorridor: {
      minSideCarryYd: -10,
      maxSideCarryYd: 10,
    },
    shots: sideCarryValues.map((sideCarryYd, index) => ({
      shotId: `shot-${index + 1}`,
      phase: "transfer",
      sideCarryYd,
      clubSpeedMph: 87 + index / 10,
    })),
  };
}
