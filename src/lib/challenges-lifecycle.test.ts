import { describe, expect, it } from "vitest";

import { filterImportedChallengeEvidenceRows } from "@/lib/challenges";

describe("imported challenge lifecycle evidence", () => {
  it("scores included evidence instead of a longer excluded shot", () => {
    const eligible = filterImportedChallengeEvidenceRows([
      shot(450, "user_excluded"),
      shot(280, "included"),
    ]);

    expect(eligible.map((row) => row.totalYd)).toEqual([280]);
    expect(Math.max(...eligible.map((row) => row.totalYd))).toBe(280);
  });

  it("accepts restored evidence even when its legacy quality tag remains excluded", () => {
    const eligible = filterImportedChallengeEvidenceRows([
      shot(280, "included"),
      { ...shot(450, "restored"), qualityTag: "bad_data" },
    ]);

    expect(Math.max(...eligible.map((row) => row.totalYd))).toBe(450);
  });

  it("rejects every excluded lifecycle state and legacy bad classification", () => {
    const eligible = filterImportedChallengeEvidenceRows([
      shot(300, "suggested_exclusion"),
      shot(301, "user_excluded"),
      shot(302, "calibration"),
      shot(303, "warm_up"),
      shot(304, "launch_monitor_error"),
      { ...shot(305, "included"), qualityTag: "bad_data" },
      { ...shot(306, "included"), shotCategory: "warm-up" },
    ]);

    expect(eligible).toEqual([]);
  });
});

function shot(totalYd: number, reviewStatus: "included" | "restored" | ExcludedStatus) {
  return {
    totalYd,
    reviewStatus,
    qualityTag: null,
    shotCategory: "full",
  };
}

type ExcludedStatus =
  | "suggested_exclusion"
  | "user_excluded"
  | "calibration"
  | "warm_up"
  | "launch_monitor_error";
