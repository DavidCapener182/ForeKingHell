import { describe, expect, it } from "vitest";
import { buildPerformanceIntelligence } from "@/lib/performance-intelligence";
import {
  benchmarkObservationMetric,
  buildEvidenceBenchmarkRows,
  type BenchmarkObservation,
} from "@/lib/benchmark-evidence";

const asOf = new Date("2026-10-18T12:00:00Z");
const club = {
  id: "driver",
  type: "driver",
  brandModel: "Synthetic test club",
  rawShotCount: 50,
  stock: { confidenceScore: 0 },
};
function shot(index: number): BenchmarkObservation {
  return {
    id: `synthetic-${index}`,
    clubId: club.id,
    sessionId: `session-${Math.floor(index / 10)}`,
    shotAt: new Date("2026-10-15"),
    sessionCreatedAt: new Date("2026-10-15"),
    carryYd: index < 30 ? 220 : 170,
    shotCategory: "full",
    source: "synthetic",
    equipmentId: "test-config",
    settingsKey: "test-settings",
    ballType: "test-ball",
    environment: "range",
    normalization: "raw",
    clubSpeedMph: index < 18 ? 90 : null,
    ballSpeedMph: 132,
    smashFactor: 1.47,
    apexFt: 90,
    descentAngleDeg: 41,
    sourceRawJson: { "Apex (ft)": "90" },
  };
}
describe("live Bag evidence assembly (synthetic fixtures)", () => {
  it("keeps carry-selected IDs with 18/30 speed coverage and no backfill", () => {
    const rows = Array.from({ length: 50 }, (_, i) => shot(i));
    rows[40]!.clubSpeedMph = 140;
    const intelligence = buildPerformanceIntelligence(rows, { asOf });
    const [result] = buildEvidenceBenchmarkRows([club], intelligence, rows);
    expect(result!.carryYd).toBe(220);
    expect(result!.metricEvidence!.clubSpeedMph!.validCount).toBe(18);
    expect(result!.metricEvidence!.clubSpeedMph!.selectedCount).toBe(30);
    expect(result!.metrics!.clubSpeedMph).toBe(90);
    expect(result!.selectedShotIds).not.toContain(rows[40]!.id);
    expect(result!.metrics!.smashFactor).toBeCloseTo(1.47, 10);
  });
  it("does not pool equipment or infer unknown apex units", () => {
    const rows = [shot(0), { ...shot(1), equipmentId: "different", carryYd: 300 }];
    const intelligence = buildPerformanceIntelligence(rows, { asOf });
    const [result] = buildEvidenceBenchmarkRows([club], intelligence, rows);
    expect(result!.sampleSize).toBe(1);
    expect(result!.carryYd).toBe(220);
    expect(
      benchmarkObservationMetric({ ...shot(0), sourceRawJson: { Apex: "90" } }, "maxHeightYd"),
    ).toBeNull();
    expect(benchmarkObservationMetric(shot(0), "maxHeightYd")).toBe(30);
  });
  it("keeps valid speed when carry is unavailable", () => {
    expect(benchmarkObservationMetric({ ...shot(0), carryYd: null }, "clubSpeedMph")).toBe(90);
  });
});
