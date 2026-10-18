import { describe, expect, it } from "vitest";
import { buildPerformanceIntelligence } from "@/lib/performance-intelligence";
import {
  benchmarkObservationMetric,
  buildEvidenceBenchmarkRows,
  resolvePeakHeightHeaderUnit,
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
  it("discloses measured, estimated and excluded readings within the same best-30 cohort", () => {
    const rows = Array.from(
      { length: 40 },
      (_, index): BenchmarkObservation => ({
        ...shot(index),
        clubSpeedMph: index < 30 ? 90 : 140,
        metricStatus: {
          clubSpeedMph: index < 10 ? "measured" : index < 20 ? "estimated" : "unknown",
        },
        sourceRawJson: index < 10 ? { "Apex (ft)": "90" } : { Apex: "90" },
      }),
    );
    const intelligence = buildPerformanceIntelligence(rows, { asOf });
    const [result] = buildEvidenceBenchmarkRows([club], intelligence, rows);
    expect(result!.selectedShotIds).toEqual(rows.slice(0, 30).map((row) => row.id));
    expect(result!.metrics!.clubSpeedMph).toBe(90);
    expect(result!.metricEvidence!.clubSpeedMph).toMatchObject({
      validCount: 20,
      selectedCount: 30,
      measuredCount: 10,
      estimatedCount: 10,
      excludedNumericCount: 10,
    });
    expect(result!.metrics!.maxHeightYd).toBe(30);
    expect(result!.metricEvidence!.maxHeightYd).toMatchObject({
      validCount: 10,
      selectedCount: 30,
      measuredCount: 0,
      estimatedCount: 0,
      excludedNumericCount: 20,
    });
  });
});

it("cannot turn explicitly unknown carry or speed provenance into a benchmark claim", () => {
  const rows: BenchmarkObservation[] = [
    { ...shot(0), carryYd: 999, metricStatus: { carryYd: "unknown" } },
    { ...shot(1), carryYd: 200, clubSpeedMph: 999, metricStatus: { clubSpeedMph: "unknown" } },
    { ...shot(2), carryYd: 180, clubSpeedMph: 90 },
  ];
  const intelligence = buildPerformanceIntelligence(rows, { asOf });
  const [result] = buildEvidenceBenchmarkRows([club], intelligence, rows);
  expect(result!.selectedShotIds).toEqual([rows[1]!.id, rows[2]!.id]);
  expect(result!.carryYd).toBe(190);
  expect(result!.metrics!.clubSpeedMph).toBe(90);
  expect(result!.metricEvidence!.clubSpeedMph!.validCount).toBe(1);
  expect(result!.metricEvidence!.clubSpeedMph!.selectedCount).toBe(2);
});

describe("explicit peak height units", () => {
  it.each(["unknown", "invalid", "unavailable"])(
    "excludes explicitly %s metric readings without borrowing other shots",
    (status) => {
      const rows = [
        {
          ...shot(0),
          attackAngleDeg: 5,
          sourceRawJson: {
            __lmwtMetricProvenance: JSON.stringify({
              attackAngleDeg: { status },
              landAngleDeg: { status },
              smashFactor: { status },
              spinRate: { status },
              launchAngleDeg: { status },
            }),
          },
          spinRate: 3000,
          launchAngleDeg: 15,
        },
        { ...shot(1), attackAngleDeg: -2 },
      ];
      const [result] = buildEvidenceBenchmarkRows(
        [club],
        buildPerformanceIntelligence(rows, { asOf }),
        rows,
      );
      expect(result!.metrics!.attackAngleDeg).toBe(-2);
      expect(result!.metricEvidence!.attackAngleDeg).toMatchObject({
        validCount: 1,
        excludedNumericCount: 1,
        selectedCount: 2,
      });
      for (const metric of ["landAngleDeg", "smashFactor", "spinRate", "launchAngleDeg"] as const)
        expect(benchmarkObservationMetric(rows[0]!, metric)).toBeNull();
    },
  );
  it.each([
    ["Apex (ft)", "feet"],
    ["Apex (feet)", "feet"],
    ["Height (foot)", "feet"],
    ["height_ft", "feet"],
    ["Max Height (yd)", "yards"],
    ["Max Height(yds)", "yards"],
    ["Maximum Height (yard)", "yards"],
    ["Peak Height [yards]", "yards"],
    ["Apex (m)", "meters"],
    ["Height (meter)", "meters"],
    ["MaxHeight (metre)", "meters"],
    ["Apex (meters)", "meters"],
    ["Height (metres)", "meters"],
  ] as const)("recognizes %s without reconverting the stored feet value", (header, unit) => {
    const raw = { [header]: unit === "feet" ? "90" : unit === "yards" ? "30" : "27.432" };
    expect(resolvePeakHeightHeaderUnit(raw, 90)).toBe(unit);
    expect(benchmarkObservationMetric({ ...shot(0), sourceRawJson: raw }, "maxHeightYd")).toBe(30);
  });
  it.each([
    "Impact Height (mm)",
    "Impact Height (ft)",
    "impact_height_ft",
    "Apex",
    "MaxHeight",
    "Height",
    "Height (mm)",
    "Club Height (ft)",
  ])("does not accept %s as explicitly comparable peak height", (header) => {
    expect(
      benchmarkObservationMetric({ ...shot(0), sourceRawJson: { [header]: "90" } }, "maxHeightYd"),
    ).toBeNull();
  });
  it("ignores impact measurements beside a valid peak-height header", () => {
    expect(
      benchmarkObservationMetric(
        { ...shot(0), sourceRawJson: { "Impact Height (mm)": "5", "Max Height (yds)": "30" } },
        "maxHeightYd",
      ),
    ).toBe(30);
  });
  it("keeps conflicting explicit peak units or values unresolved", () => {
    const conflictingRows: Record<string, string>[] = [
      { "Apex (ft)": "90", "Height (yards)": "35" },
      { "Apex (ft)": "90", "Height (ft)": "95" },
    ];
    for (const raw of conflictingRows) {
      expect(
        benchmarkObservationMetric({ ...shot(0), sourceRawJson: raw }, "maxHeightYd"),
      ).toBeNull();
    }
  });
  it("accepts equivalent explicit feet and yards readings that both match stored height", () => {
    expect(
      benchmarkObservationMetric(
        { ...shot(0), sourceRawJson: { "Apex (ft)": "90", "Height (yards)": "30" } },
        "maxHeightYd",
      ),
    ).toBe(30);
  });
  it("recovers an explicit TrackMan height when unitless aliases coexist and agree with stored feet", () => {
    const raw = {
      MaxHeight: "30",
      Height: "30",
      "Max Height (yds)": "30",
      "Impact Height (mm)": "5",
    };
    expect(resolvePeakHeightHeaderUnit(raw, 90)).toBe("yards");
    expect(
      benchmarkObservationMetric({ ...shot(0), apexFt: 90, sourceRawJson: raw }, "maxHeightYd"),
    ).toBe(30);
    expect(
      benchmarkObservationMetric({ ...shot(0), apexFt: 95, sourceRawJson: raw }, "maxHeightYd"),
    ).toBeNull();
  });
  it("requires numeric explicit raw values and tolerates only storage rounding", () => {
    expect(resolvePeakHeightHeaderUnit({ "Apex (ft)": "90" }, 90.001)).toBe("feet");
    expect(resolvePeakHeightHeaderUnit({ "Apex (ft)": "90" }, 90.1)).toBeNull();
    expect(resolvePeakHeightHeaderUnit({ "Apex (ft)": "not recorded" }, 90)).toBeNull();
    expect(resolvePeakHeightHeaderUnit({ "Apex (ft)": "90" }, null)).toBeNull();
  });
  it("reads encoded legacy raw objects but keeps unitless encoded Apex unresolved", () => {
    expect(
      benchmarkObservationMetric(
        { ...shot(0), sourceRawJson: JSON.stringify({ "Apex (ft)": "90" }) },
        "maxHeightYd",
      ),
    ).toBe(30);
    expect(
      benchmarkObservationMetric(
        { ...shot(0), sourceRawJson: JSON.stringify({ Apex: "90" }) },
        "maxHeightYd",
      ),
    ).toBeNull();
  });
  it.each([
    "broken JSON",
    "null",
    "[]",
    JSON.stringify({ apexYd: { comparable: false, unit: "yd", status: "measured", value: 30 } }),
    JSON.stringify({ apexYd: { comparable: true, unit: "yd", status: "unknown", value: 30 } }),
    JSON.stringify({ apexYd: { comparable: true, unit: "ft", status: "measured", value: 90 } }),
    JSON.stringify({ apexYd: { comparable: true, unit: "yd", status: "measured" } }),
  ])("blocks malformed or explicitly incomparable apex provenance: %s", (metadata) => {
    expect(
      benchmarkObservationMetric(
        { ...shot(0), sourceRawJson: { "Apex (ft)": "90", __lmwtMetricProvenance: metadata } },
        "maxHeightYd",
      ),
    ).toBeNull();
  });
  it("uses verified explicit height evidence when valid partial provenance has no apex entry", () => {
    for (const metadata of ["{}", JSON.stringify({ clubSpeedMph: { status: "measured" } })]) {
      expect(
        benchmarkObservationMetric(
          { ...shot(0), sourceRawJson: { "Apex (ft)": "90", __lmwtMetricProvenance: metadata } },
          "maxHeightYd",
        ),
      ).toBe(30);
      expect(
        benchmarkObservationMetric(
          { ...shot(0), sourceRawJson: { Apex: "90", __lmwtMetricProvenance: metadata } },
          "maxHeightYd",
        ),
      ).toBeNull();
    }
  });
  it("accepts a valid normalized apex reading with original unit evidence and divides feet once", () => {
    const metadata = JSON.stringify({
      apexYd: { comparable: true, unit: "yd", rawUnit: "ft", status: "measured", value: 30 },
    });
    expect(
      benchmarkObservationMetric(
        { ...shot(0), sourceRawJson: { __lmwtMetricProvenance: metadata } },
        "maxHeightYd",
      ),
    ).toBe(30);
  });
});
