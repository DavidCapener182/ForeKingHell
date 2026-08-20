import { describe, expect, it } from "vitest";

import { analyseEquipmentChange, type EquipmentChangeShot } from "@/lib/equipment-change-analysis";

describe("equipment change analysis", () => {
  it("compares robust before and after windows and keeps the causation caveat", () => {
    const changeAt = new Date("2026-05-01T00:00:00Z");
    const shots = [
      ...makeShots("before", "2026-04-10T00:00:00Z", [140, 141, 142, 143, 144, 600]),
      ...makeShots("after", "2026-05-10T00:00:00Z", [145, 146, 147, 148, 149, 650]),
    ];
    const result = analyseEquipmentChange({ clubId: "7i", changeAt, shots });

    expect(result.comparable).toBe(true);
    expect(result.before.carryMedianYd).toBeCloseTo(142.5, 1);
    expect(result.after.carryMedianYd).toBeCloseTo(147.5, 1);
    expect(result.deltas.carryYd).toBe(5);
    expect(result.caveat).toContain("does not prove");
  });

  it("keeps low samples non-comparable", () => {
    const result = analyseEquipmentChange({
      clubId: "7i",
      changeAt: new Date("2026-05-01T00:00:00Z"),
      shots: makeShots("after", "2026-05-10T00:00:00Z", [145, 146, 147]),
    });

    expect(result.comparable).toBe(false);
    expect(result.confidence.label).toBe("early");
  });

  it("uses only included or restored lifecycle evidence", () => {
    const excludedStatuses = [
      "suggested_exclusion",
      "user_excluded",
      "calibration",
      "warm_up",
      "launch_monitor_error",
    ] as const;
    const shots: EquipmentChangeShot[] = [
      ...makeShots("included-before", "2026-04-10T00:00:00Z", [140]),
      ...makeShots("included-after", "2026-05-10T00:00:00Z", [150]),
      ...makeShots("restored-before", "2026-04-11T00:00:00Z", [142]).map((shot) => ({
        ...shot,
        reviewStatus: "restored" as const,
        qualityTag: "bad_data",
      })),
      ...makeShots("restored-after", "2026-05-11T00:00:00Z", [152]).map((shot) => ({
        ...shot,
        reviewStatus: "restored" as const,
        qualityTag: "mishit",
      })),
      ...excludedStatuses.flatMap((reviewStatus, index) =>
        makeShots(`excluded-${reviewStatus}`, "2026-05-12T00:00:00Z", [300 + index]).map(
          (shot) => ({ ...shot, reviewStatus }),
        ),
      ),
      ...makeShots("legacy-bad", "2026-05-13T00:00:00Z", [400]).map((shot) => ({
        ...shot,
        reviewStatus: "included" as const,
        qualityTag: "launch-monitor-error",
      })),
    ];

    const result = analyseEquipmentChange({
      clubId: "7i",
      changeAt: new Date("2026-05-01T00:00:00Z"),
      shots,
    });

    expect(result.before.sampleSize).toBe(2);
    expect(result.after.sampleSize).toBe(2);
    expect(result.before.carryMedianYd).toBe(141);
    expect(result.after.carryMedianYd).toBe(151);
  });
});

function makeShots(sessionId: string, date: string, carries: number[]): EquipmentChangeShot[] {
  return carries.map((carryYd, index) => ({
    sessionId,
    clubId: "7i",
    shotAt: new Date(new Date(date).getTime() + index * 60_000),
    carryYd,
    totalYd: carryYd + 5,
    sideYd: index % 2 ? 5 : -4,
    ballSpeedMph: 105 + index,
    launchAngleDeg: 18,
    spinRate: 5_500,
    smashFactor: 1.35,
    qualityTag: null,
    shotCategory: "full",
    reviewStatus: "included",
    sessionSource: "rapsodo",
    sessionType: "range",
  }));
}
