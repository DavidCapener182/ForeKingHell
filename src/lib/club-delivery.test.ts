import { describe, expect, it } from "vitest";
import {
  deliveryObservation,
  deliverySummary,
  deliveryTendency,
  observedCurve,
  targetSide,
} from "./club-delivery";
import { parseRapsodoCsv } from "./rapsodo/parser";

const shot = { carryYd: 200, totalYd: null, sideCarryYd: 5, clubPathDeg: 3.3, faceAngleDeg: 1 };
describe("club delivery assessment", () => {
  it.each([
    [3.3, 1, "right", "Push-draw tendency", "Closed relative to path"],
    [-3, -1, "right", "Pull-fade tendency", "Open relative to path"],
    [3, 3, "right", "Straight push tendency", "Square relative to path"],
    [0, 0, "right", "Straight tendency", "Square relative to path"],
    [-3, -1, "left", "Push-draw tendency", "Closed relative to path"],
    [3.3, 1, "left", "Pull-fade tendency", "Open relative to path"],
    [-3, -3, "left", "Straight push tendency", "Square relative to path"],
  ] as const)("interprets path %s and face %s for %s", (path, face, hand, label, reference) => {
    const stats = deliverySummary([
      deliveryObservation({ ...shot, clubPathDeg: path, faceAngleDeg: face }),
    ]);
    expect(deliveryTendency(stats.face, stats.delta, hand)).toEqual({ label, reference });
    expect(targetSide(face)).toBe(
      face > 0 ? "Right of target" : face < 0 ? "Left of target" : "On target line",
    );
  });
  it.each([
    [-15, "right", "hook"],
    [15, "right", "slice"],
    [-15, "left", "slice"],
    [15, "left", "hook"],
    [0, "left", "straight"],
  ] as const)("interprets verified axis %s for %s", (axis, hand, expected) =>
    expect(observedCurve(axis, hand)).toBe(expected),
  );
  it("keeps a mixed distribution and pairs arrows on the same impacts", () => {
    const stats = deliverySummary(
      [8, -8, 8, -8, null].map((n) =>
        deliveryObservation({ ...shot, clubPathDeg: n === null ? 100 : 0, faceAngleDeg: n }),
      ),
    );
    expect(stats).toMatchObject({ path: 0, face: 0, delta: 0, median: 0, low: -8, high: 8 });
    expect(stats.deltas).toHaveLength(4);
  });
  it("retains unknown face provenance and withholds unverified spin", () => {
    expect(deliveryObservation({ ...shot, spinAxis: 20 })).toMatchObject({
      axis: null,
      source: "unverified",
    });
    expect(deliveryObservation({ ...shot, faceAngleDeg: null })).toMatchObject({
      delta: null,
      source: "missing",
    });
    expect(
      deliveryObservation({ ...shot, faceAngleDeg: null, launchDirectionDeg: 1 }),
    ).toMatchObject({ source: "estimated" });
  });
  it("reads calculated and direct face provenance from the import pipeline", () => {
    const imported = parseRapsodoCsv(
      "Club Type,Carry Distance (yd),Club Path,Launch Direction,Face Angle,Spin Axis,Club Data Est Type\nDriver,200,3,1,,0,0\nDriver,200,3,1,1,-4,0",
    ).shots;
    expect(imported.map(deliveryObservation)).toMatchObject([
      { source: "estimated", axis: null },
      { source: "measured", axis: null },
    ]);
  });
});
