import { describe, expect, it } from "vitest";

import {
  buildCourseTwinPuttEventPayload,
  buildCourseTwinPuttReplay,
  simulateCourseTwinPutt,
  type CourseTwinPuttingEnvironment,
} from "@/lib/course-twin-putting";

const flatGreen: CourseTwinPuttingEnvironment = {
  groundHeight: () => 0,
  surfaceAt: () => "green",
};

describe("Course Twin deterministic putting", () => {
  it("holes a correctly paced straight putt on a flat reviewed green", () => {
    const result = simulateCourseTwinPutt(
      {
        start: { x: 0, y: 0, z: 0 },
        hole: { x: 0, y: 0, z: 3 },
        aimOffsetDeg: 0,
        pacePercent: 100,
      },
      flatGreen,
    );

    expect(result.holed).toBe(true);
    expect(result.remainingDistanceM).toBe(0);
    expect(result.frames.length).toBeGreaterThan(10);
    expect(result.frames.at(-1)?.phase).toBe("stopped");
    expect(result.totalDistanceM).toBeGreaterThan(2.8);
    expect(result.totalDistanceM).toBeLessThan(3.3);
  });

  it("misses when aimed outside the cup and reports the leave", () => {
    const result = simulateCourseTwinPutt(
      {
        start: { x: 0, y: 0, z: 0 },
        hole: { x: 0, y: 0, z: 4 },
        aimOffsetDeg: 6,
        pacePercent: 100,
      },
      flatGreen,
    );

    expect(result.holed).toBe(false);
    expect(result.remainingDistanceM).toBeGreaterThan(0.25);
    expect(result.finalPosition.x).not.toBeCloseTo(0, 1);
  });

  it("breaks downhill on a sloping surveyed grid", () => {
    const result = simulateCourseTwinPutt(
      {
        start: { x: 0, y: 0, z: 0 },
        hole: { x: 0, y: 0, z: 5 },
        aimOffsetDeg: 0,
        pacePercent: 95,
      },
      {
        groundHeight: (x) => x * 0.025,
        surfaceAt: () => "green",
      },
    );

    expect(result.finalPosition.x).toBeLessThan(-0.15);
    expect(result.holed).toBe(false);
  });

  it("builds a bounded ledger payload without claiming measured provenance", () => {
    const result = simulateCourseTwinPutt(
      {
        start: { x: 0, y: 0, z: 0 },
        hole: { x: 0, y: 0, z: 3 },
        aimOffsetDeg: 0,
        pacePercent: 100,
      },
      flatGreen,
    );

    expect(
      buildCourseTwinPuttEventPayload({
        holeNumber: 1,
        puttNumber: 1,
        result,
      }),
    ).toMatchObject({
      holeNumber: 1,
      puttNumber: 1,
      source: "modelled",
      holed: true,
      aimOffsetDeg: 0,
      pacePercent: 100,
    });
    expect(
      buildCourseTwinPuttReplay({
        id: "putt-1",
        holeNumber: 1,
        puttNumber: 1,
        result,
      }),
    ).toMatchObject({
      shot: { clubType: "putter", rollProvenance: "reconstructed" },
      simulation: {
        provenance: "putting-contour-model",
        bounceCount: 0,
        penalty: null,
      },
    });
  });
});
