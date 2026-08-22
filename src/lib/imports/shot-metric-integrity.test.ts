import { describe, expect, it } from "vitest";

import { quarantineIncompatibleTotalDistance } from "@/lib/imports/shot-metric-integrity";

describe("quarantineIncompatibleTotalDistance", () => {
  it("quarantines at the larger of the 20-yard and 20-percent boundaries", () => {
    expect(
      quarantineIncompatibleTotalDistance({ carryYd: 100, totalYd: 80, rowNumber: 2 }).totalYd,
    ).toBeNull();
    expect(
      quarantineIncompatibleTotalDistance({ carryYd: 200, totalYd: 160, rowNumber: 3 }).totalYd,
    ).toBeNull();
  });

  it("returns a structured issue for import summaries without discarding carry", () => {
    expect(
      quarantineIncompatibleTotalDistance({ carryYd: 136.8, totalYd: 8.8, rowNumber: 13 }),
    ).toEqual({
      totalYd: null,
      warning:
        "Row 13: total distance 8.8 yd is incompatible with carry distance 136.8 yd; only the total-distance field was quarantined.",
      issue: {
        code: "total_below_carry",
        field: "totalYd",
        value: 8.8,
        explanation: "Total distance 8.8 yd is incompatible with carry distance 136.8 yd.",
      },
    });
  });

  it("preserves values immediately inside both quarantine boundaries", () => {
    expect(
      quarantineIncompatibleTotalDistance({ carryYd: 100, totalYd: 80.1, rowNumber: 2 }).totalYd,
    ).toBe(80.1);
    expect(
      quarantineIncompatibleTotalDistance({ carryYd: 200, totalYd: 160.1, rowNumber: 3 }).totalYd,
    ).toBe(160.1);
  });
});
