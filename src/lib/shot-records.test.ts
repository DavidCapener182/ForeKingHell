import { describe, expect, it } from "vitest";

import { recordEligibility, selectAllTimeRecord } from "@/lib/shot-records";

describe("recordEligibility", () => {
  it.each(["bad_data", "bad-data", "misread", "delete", "deleted", "invalid", "excluded"])(
    "excludes %s quality tags from trusted records",
    (qualityTag) => {
      expect(
        recordEligibility({
          carryYd: 280,
          totalYd: 300,
          qualityTag,
          shotCategory: "full",
          sessionSource: "rapsodo",
        }),
      ).toMatchObject({ rawEligible: true, trustedEligible: false });
    },
  );

  it("distinguishes raw manual maxima from trusted launch-monitor records", () => {
    expect(
      recordEligibility({
        carryYd: 320,
        totalYd: 350,
        qualityTag: null,
        shotCategory: "full",
        sessionSource: "manual",
      }),
    ).toEqual({
      rawEligible: true,
      trustedEligible: false,
      reasons: ["manual-source"],
    });
  });

  it("rejects missing and non-positive distance values", () => {
    expect(
      recordEligibility({
        carryYd: null,
        totalYd: 0,
        qualityTag: null,
        shotCategory: "full",
        sessionSource: "rapsodo",
      }),
    ).toMatchObject({ rawEligible: false, trustedEligible: false });
  });

  it.each(["user_excluded", "calibration", "warm_up", "launch_monitor_error"] as const)(
    "treats %s lifecycle state as excluded even without a compatibility tag",
    (reviewStatus) => {
      expect(
        recordEligibility({
          carryYd: 280,
          totalYd: 300,
          reviewStatus,
          qualityTag: null,
          shotCategory: "full",
          sessionSource: "rapsodo",
        }),
      ).toEqual({ rawEligible: true, trustedEligible: false, reasons: ["review-status"] });
    },
  );

  it("keeps a clean suggested exclusion eligible until the player accepts it", () => {
    expect(
      recordEligibility({
        carryYd: 280,
        totalYd: 300,
        reviewStatus: "suggested_exclusion",
        qualityTag: null,
        shotCategory: "full",
        sessionSource: "rapsodo",
      }),
    ).toEqual({ rawEligible: true, trustedEligible: true, reasons: [] });
  });

  it("still excludes a legacy suggested mishit through its retained quality tag", () => {
    expect(
      recordEligibility({
        carryYd: 280,
        totalYd: 300,
        reviewStatus: "suggested_exclusion",
        qualityTag: "mishit",
        shotCategory: "full",
        sessionSource: "rapsodo",
      }),
    ).toEqual({ rawEligible: true, trustedEligible: false, reasons: ["quality-tag"] });
  });
});

describe("selectAllTimeRecord", () => {
  it("finds an eligible record older than the latest 50 shots", () => {
    const shots = Array.from({ length: 75 }, (_, index) => ({
      id: `shot-${index}`,
      carryYd: index === 0 ? 305 : 250 + (index % 20),
      totalYd: index === 0 ? 326 : 270 + (index % 20),
      qualityTag: null,
      shotCategory: "full",
      sessionSource: "rapsodo",
    }));

    expect(selectAllTimeRecord(shots, "total", "trusted")?.id).toBe("shot-0");
  });

  it("keeps a larger misread as raw while selecting the trusted maximum separately", () => {
    const shots = [
      {
        id: "misread",
        carryYd: 410,
        totalYd: 430,
        qualityTag: "misread",
        shotCategory: "full",
        sessionSource: "rapsodo",
      },
      {
        id: "trusted",
        carryYd: 295,
        totalYd: 315,
        qualityTag: null,
        shotCategory: "full",
        sessionSource: "rapsodo",
      },
    ];

    expect(selectAllTimeRecord(shots, "total", "raw")?.id).toBe("misread");
    expect(selectAllTimeRecord(shots, "total", "trusted")?.id).toBe("trusted");
  });
});
