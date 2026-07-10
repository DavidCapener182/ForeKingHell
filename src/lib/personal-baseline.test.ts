import { describe, expect, it } from "vitest";

import { buildPersonalBaselines, type BaselineShot } from "@/lib/personal-baseline";

describe("buildPersonalBaselines", () => {
  it("separates 30-day, 90-day and all-time trusted evidence", () => {
    const referenceDate = new Date("2026-07-10T12:00:00Z");
    const shots: BaselineShot[] = [
      ...rows(8, "2026-07-05T12:00:00Z", 160, "recent"),
      ...rows(8, "2026-05-20T12:00:00Z", 155, "mid"),
      ...rows(8, "2025-01-10T12:00:00Z", 145, "old"),
      { ...rows(1, "2026-07-09T12:00:00Z", 400, "bad")[0]!, trusted: false },
    ];
    const baseline = buildPersonalBaselines(shots, { referenceDate, minimumSamples: 8 })[0]!;
    expect(baseline.recent30?.carryMedianYd).toBeCloseTo(160.5, 1);
    expect(baseline.recent90?.sampleSize).toBe(16);
    expect(baseline.allTime?.sampleSize).toBe(24);
    expect(baseline.allTime?.carryMedianYd).toBeCloseTo(155.5, 1);
  });

  it("does not publish an unsupported baseline", () => {
    expect(
      buildPersonalBaselines(rows(3, "2026-07-05T12:00:00Z", 160, "small"), {
        referenceDate: new Date("2026-07-10T12:00:00Z"),
        minimumSamples: 8,
      })[0]?.allTime,
    ).toBeNull();
  });
});

function rows(count: number, date: string, carry: number, sessionId: string): BaselineShot[] {
  return Array.from({ length: count }, (_, index) => ({
    clubId: "7i",
    shotType: "stock",
    sessionId,
    shotAt: new Date(date),
    carryYd: carry + (index % 2),
    sideYd: (index % 3) - 1,
    trusted: true,
  }));
}
