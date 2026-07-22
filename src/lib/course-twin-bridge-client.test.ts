import { describe, expect, it } from "vitest";

import {
  bridgeShotToReplayShot,
  type CourseTwinBridgeShotEvent,
} from "@/lib/course-twin-bridge-client";
import type { CourseTwinHole } from "@/lib/course-twin-contract";

const hole: CourseTwinHole = {
  holeNumber: 5,
  par: 4,
  yards: 390,
  strokeIndex: 7,
  tee: [10, 0, 20],
  green: [10, 0, -330],
  centerline: [
    [10, 0, 20],
    [10, 0, -330],
  ],
};

const event: CourseTwinBridgeShotEvent = {
  type: "shot",
  eventId: "event-1",
  receivedAt: "2026-07-22T12:00:00.000Z",
  source: "gspro-open-connect-v1",
  shot: {
    kind: "shot",
    deviceId: "Rapsodo MLM2PRO",
    shotNumber: 1,
    receivedUnits: "Yards",
    ballDetected: true,
    ready: true,
    ball: {
      speedMph: 145,
      horizontalLaunchDeg: 4,
      verticalLaunchDeg: 14,
      spinAxisDeg: -3,
      totalSpinRpm: 2600,
      carryDistanceYards: 240,
    },
    club: null,
  },
};

describe("Course Twin bridge shot mapping", () => {
  it("maps measured GSPro metrics into a replay shot aimed from the current lie", () => {
    const result = bridgeShotToReplayShot({
      event,
      hole,
      start: hole.tee,
      clubType: "driver",
      holeShotNumber: 1,
    });
    expect(result.metrics.carryYd).toEqual({ value: 240, provenance: "measured" });
    expect(result.metrics.ballSpeedMph).toEqual({ value: 145, provenance: "measured" });
    expect(result.metrics.spinRate).toEqual({ value: 2600, provenance: "measured" });
    expect(result.carryEnd[0]).toBeGreaterThan(hole.tee[0]);
    expect(result.carryEnd[2]).toBeLessThan(hole.tee[2]);
    expect(result.totalEnd[2]).toBeLessThan(result.carryEnd[2]);
  });

  it("marks carry as derived when the monitor does not send it", () => {
    const result = bridgeShotToReplayShot({
      event: {
        ...event,
        shot: { ...event.shot, ball: { ...event.shot.ball, carryDistanceYards: null } },
      },
      hole,
      start: hole.tee,
      clubType: "7 iron",
      holeShotNumber: 2,
    });
    expect(result.metrics.carryYd.provenance).toBe("derived");
    expect(result.metrics.carryYd.value).toBeGreaterThan(100);
  });
});
