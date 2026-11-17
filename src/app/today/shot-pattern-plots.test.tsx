import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SharedShotPatternVisual } from "./today-shot-charts";
import { withinShotTime } from "@/components/visuals/shot-time-range";
import { landingContours } from "@/components/visuals/landing-contours";
import { buildShotPatternPoints, summarizeShotPattern } from "@/lib/shot-pattern-chart-data";
import { deliveryObservation } from "@/lib/club-delivery";

const record = {
  clubType: "driver",
  clubLabel: "Driver",
  shotNumber: 12,
  carryYd: 200,
  sideCarryYd: 2,
  apexFt: 80,
  launchAngleDeg: 15,
};
const shots = [
  { ...record, id: "short", carryYd: 12 },
  { ...record, id: "mishit", carryYd: 0, sideCarryYd: -120 },
  { ...record, id: "missing-apex", apexFt: null },
  { ...record, id: "missing-side", sideCarryYd: null },
  { ...record, id: "total-only", carryYd: null, totalYd: 240 },
  { ...record, id: "alignment", alignmentFlagged: true },
];
describe("paired shot pattern plots", () => {
  it("plots carry and side on the same row, including zero carry, and omits flagged lateral readings", () => {
    const html = renderToStaticMarkup(<SharedShotPatternVisual shots={shots} mode="dispersion" />);
    expect([...html.matchAll(/data-today-shot-point="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "short",
      "mishit",
      "missing-apex",
    ]);
  });
  it("requires a positive carry and reported apex, independently of side or shot number", () => {
    const html = renderToStaticMarkup(
      <SharedShotPatternVisual
        shots={shots}
        mode="trajectory"
        apexScale={180}
        dispersionScale={{ maxCarryYd: 220, maxSideYd: 150, targetSideYd: 10 }}
      />,
    );
    expect([...html.matchAll(/data-today-shot-flight="([^"]+)"/g)].map((m) => m[1])).toEqual([
      "short",
      "missing-side",
      "alignment",
    ]);
    expect(html).toContain('data-trajectory-max-carry="220"');
  });
  it("excludes questioned alignment from configured hit rates while preserving other measurements", () => {
    const points = buildShotPatternPoints([
      { ...record, id: "a", sideCarryYd: -20 },
      { ...record, id: "b", sideCarryYd: 20 },
      { ...record, id: "c", dataConfidence: { alignment: "misaligned" } },
    ]);
    expect(summarizeShotPattern(points, 10)).toMatchObject({
      sampleSize: 2,
      insideCorridor: 0,
      signedMiss: 0,
      absoluteMiss: 20,
    });
    expect(summarizeShotPattern(points, 20).insideCorridor).toBe(2);
  });
  it("includes the full ending minute and requires a timestamp only for active time filters", () => {
    expect(withinShotTime(null, { from: "", to: "" })).toBe(true);
    expect(withinShotTime(null, { from: "2026-10-03T10:00", to: "" })).toBe(false);
    const range = { from: "2026-10-03T10:00", to: "2026-10-03T11:00" };
    expect(withinShotTime("2026-10-03T11:00:59", range)).toBe(true);
    expect(withinShotTime("2026-10-03T11:01:00", range)).toBe(false);
  });
  it("omits singular and pooled contours and sizes the outer contour from observed distances", () => {
    const cloud: [number, number][] = [
      [0, 0],
      [1, 3],
      [4, 5],
      [5, 7],
      [7, 11],
      [30, 40],
    ];
    expect(landingContours(cloud, 2)).toBeNull();
    expect(
      landingContours(
        [
          [0, 0],
          [1, 1],
          [2, 2],
          [3, 3],
        ],
        1,
      ),
    ).toBeNull();
    const ellipse = landingContours(cloud, 1)!;
    expect(ellipse.outer).toBeGreaterThanOrEqual(ellipse.inner);
    expect(ellipse.angle).toBeGreaterThan(0);
  });
  it("retains signed impact offsets and identifies historical modelled face readings", () => {
    expect(
      deliveryObservation({
        ...record,
        clubPathDeg: 3,
        launchDirectionDeg: 1,
        faceAngleDeg: 0.5,
        totalYd: null,
        sourceRawJson: { "Impact Offset (mm)": "0", "Impact Height (mm)": "-3" },
      }),
    ).toMatchObject({ source: "estimated", strike: "offset 0 mm, height -3 mm" });
  });
});
