import { describe, expect, it } from "vitest";
import { comparableBagStock } from "./bag-performance-stock";
import { buildPerformanceIntelligence, type PerformanceShot } from "./performance-intelligence";
describe("Bag current gapping cohort", () => {
  it("uses latest full context instead of pooled source/equipment while preserving all-time PB", () => {
    const rows: PerformanceShot[] = ["current", "old"].flatMap((kind) =>
      Array.from({ length: 15 }, (_, i) => ({
        id: `${kind}${i}`,
        clubId: "driver",
        sessionId: kind,
        shotAt: kind === "current" ? "2026-10-17" : "2026-10-01",
        carryYd: kind === "current" ? 170 : 260,
        source: kind,
        equipmentId: kind,
        shotCategory: "full",
      })),
    );
    const data = buildPerformanceIntelligence(rows, { asOf: new Date("2026-10-18") });
    const stock = comparableBagStock("driver", data, rows, 300);
    expect(stock.carryMedianYd).toBe(170);
    expect(stock.coursePlayCarryYd).toBe(170);
    expect(stock.sampleSize).toBe(15);
    expect(stock.personalBestCarryYd).toBe(300);
  });
  it("does not fall back to pooled legacy carry when no current eligible stock exists", () => {
    expect(
      comparableBagStock("driver", buildPerformanceIntelligence([]), [], 300).coursePlayCarryYd,
    ).toBeNull();
  });
});
