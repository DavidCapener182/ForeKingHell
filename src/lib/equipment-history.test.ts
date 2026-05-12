import { describe, expect, it } from "vitest";

import { normalizeEquipmentHistory } from "@/lib/equipment-history";

describe("equipment history", () => {
  it("normalizes bounded club specs and trims text fields", () => {
    const normalized = normalizeEquipmentHistory(
      {
        effectiveFrom: "2026-05-01T00:00:00.000Z",
        loftDeg: 34.44,
        lieDeg: 62.26,
        shaft: "  Dynamic Gold 105  ",
        swingWeight: " D2 ",
      },
      new Date("2026-05-12T00:00:00.000Z"),
    );

    expect(normalized.loftDeg).toBe(34.4);
    expect(normalized.lieDeg).toBe(62.3);
    expect(normalized.shaft).toBe("Dynamic Gold 105");
    expect(normalized.swingWeight).toBe("D2");
  });

  it("rejects impossible date ranges", () => {
    expect(() =>
      normalizeEquipmentHistory({
        effectiveFrom: "2026-05-12T00:00:00.000Z",
        effectiveTo: "2026-05-01T00:00:00.000Z",
      }),
    ).toThrow("end date");
  });

  it("rejects out-of-range lie and loft values", () => {
    expect(() => normalizeEquipmentHistory({ loftDeg: 90 })).toThrow("Loft");
    expect(() => normalizeEquipmentHistory({ lieDeg: 20 })).toThrow("Lie");
  });
});
