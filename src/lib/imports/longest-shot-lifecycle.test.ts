import { describe, expect, it } from "vitest";

import {
  buildLongestShotNotifications,
  maxEligibleShotDistance,
} from "@/lib/imports/save-rapsodo-import";
import type { ParsedRapsodoShot } from "@/lib/rapsodo/parser";
import type { ShotReviewStatus } from "@/lib/shot-review";

describe("longest-shot lifecycle evidence", () => {
  it("builds a PB from included evidence instead of a longer excluded row", () => {
    const excludedStatuses = [
      "suggested_exclusion",
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ] as const;
    const notifications = buildLongestShotNotifications({
      importedShots: [
        importedShot({ rowNumber: 1, totalYd: 250, reviewStatus: "included" }),
        ...excludedStatuses.map((reviewStatus, index) =>
          importedShot({
            rowNumber: index + 2,
            totalYd: 450 + index,
            reviewStatus,
          }),
        ),
        importedShot({
          rowNumber: 7,
          totalYd: 470,
          reviewStatus: "included",
          qualityTag: "bad_data",
        }),
        importedShot({
          rowNumber: 8,
          totalYd: 480,
          reviewStatus: "included",
          qualityTag: "warm-up",
        }),
      ],
      clubIdByKey: new Map([["driver-key", "driver-id"]]),
      previousLongestByClubId: new Map([["driver-id", 240]]),
      sessionId: "session-id",
      fileName: "reviewed.csv",
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.shotDistanceYd).toBe(250);
  });

  it("accepts restored evidence even when a legacy bad-data tag remains", () => {
    const notifications = buildLongestShotNotifications({
      importedShots: [
        importedShot({
          totalYd: 450,
          reviewStatus: "restored",
          qualityTag: "bad_data",
        }),
      ],
      clubIdByKey: new Map([["driver-key", "driver-id"]]),
      previousLongestByClubId: new Map([["driver-id", 300]]),
      sessionId: "session-id",
      fileName: "restored.csv",
    });

    expect(notifications[0]?.shotDistanceYd).toBe(450);
  });

  it("ignores excluded prior monsters when calculating the prior PB", () => {
    const previousDistance = maxEligibleShotDistance([
      historicalShot(500, "suggested_exclusion"),
      historicalShot(501, "user_excluded"),
      historicalShot(502, "calibration"),
      historicalShot(503, "warm_up"),
      historicalShot(504, "launch_monitor_error"),
      { ...historicalShot(510, "included"), qualityTag: "bad_data" },
      historicalShot(280, "included"),
      { ...historicalShot(450, "restored"), qualityTag: "bad_data" },
    ]);

    expect(previousDistance).toBe(450);
  });
});

function importedShot(
  overrides: Partial<ParsedRapsodoShot> & { reviewStatus?: ShotReviewStatus | null } = {},
): ParsedRapsodoShot & { reviewStatus?: ShotReviewStatus | null } {
  return {
    rowNumber: 1,
    shotNumber: 1,
    clubTypeRaw: "Driver",
    clubType: "driver",
    clubLabel: "Driver",
    clubBrand: "Test",
    clubModel: "Driver",
    clubKey: "driver-key",
    carryYd: 240,
    totalYd: 250,
    ballSpeedMph: 140,
    clubSpeedMph: 95,
    launchAngleDeg: 14,
    launchDirectionDeg: 0,
    apexFt: 90,
    sideCarryYd: 0,
    attackAngleDeg: 2,
    clubPathDeg: 1,
    faceAngleDeg: 1,
    descentAngleDeg: 35,
    smashFactor: 1.47,
    spinRate: 2400,
    spinAxis: 0,
    shotShape: "straight",
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: "measured",
    sourceRawJson: {},
    warnings: [],
    ...overrides,
  };
}

function historicalShot(distance: number, reviewStatus: ShotReviewStatus) {
  return {
    carryYd: distance - 10,
    totalYd: distance,
    reviewStatus,
    qualityTag: null,
    shotCategory: "full",
  };
}
