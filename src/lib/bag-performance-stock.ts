import { calculateStockYardage, type StockYardage } from "@/lib/stock-yardage";
import {
  performanceMetricValue,
  type PerformanceIntelligence,
  type PerformanceShot,
} from "@/lib/performance-intelligence";

/** Gapping uses the same current stock cohort as the evidence panel, not pooled devices/configurations. */
export function comparableBagStock(
  clubId: string,
  intelligence: PerformanceIntelligence,
  observations: PerformanceShot[],
  personalBestCarryYd: number | null,
): StockYardage {
  const group = intelligence.groups
    .filter((g) => g.clubId === clubId && g.context.intent === "full")
    .sort(
      (a, b) =>
        (b.current.endAt ?? "").localeCompare(a.current.endAt ?? "") || a.id.localeCompare(b.id),
    )[0];
  const ids = new Set(group?.current.stockShotIds ?? []);
  const rows = observations
    .filter((s) => ids.has(s.id))
    .map((s) => ({
      ...s,
      carryYd: performanceMetricValue(s, "carryYd"),
      sideCarryYd: performanceMetricValue(s, "sideCarryYd"),
      ballSpeedMph: performanceMetricValue(s, "ballSpeedMph"),
      totalYd: null,
      reviewStatus: "included" as const,
    }));
  return { ...calculateStockYardage(rows, rows.length), personalBestCarryYd };
}
