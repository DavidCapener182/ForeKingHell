import { describe, expect, it } from "vitest";

import { buildShotShapeTrace } from "./shot-shape-trace";

describe("shot shape trace", () => {
  it("returns null without carry and side landing data", () => {
    expect(
      buildShotShapeTrace({
        id: "missing-carry",
        carryYd: null,
        sideCarryYd: 12,
        maxCarryYd: 250,
        maxSideYd: 40,
      }),
    ).toBeNull();
    expect(
      buildShotShapeTrace({
        id: "missing-side",
        carryYd: 180,
        sideCarryYd: null,
        maxCarryYd: 250,
        maxSideYd: 40,
      }),
    ).toBeNull();
  });

  it("builds a landing-only curve when start and spin telemetry are unavailable", () => {
    const trace = buildShotShapeTrace({
      id: "landing-only",
      carryYd: 180,
      sideCarryYd: -20,
      maxCarryYd: 240,
      maxSideYd: 40,
    });

    expect(trace).toMatchObject({
      source: "landing",
      landingX: 31,
      landingY: 34,
    });
    expect(trace?.controlX).toBeLessThan(50);
    expect(trace?.path).toBe("M 50 88 Q 43.54 56.68 31 34");
  });

  it("uses launch direction to show a shot starting left before finishing right", () => {
    const trace = buildShotShapeTrace({
      id: "pull-fade",
      carryYd: 220,
      sideCarryYd: 18,
      launchDirectionDeg: -10,
      maxCarryYd: 220,
      maxSideYd: 40,
    });

    expect(trace?.source).toBe("launch");
    expect(trace?.landingX).toBeGreaterThan(50);
    expect(trace?.controlX).toBeLessThan(50);
  });

  it("classifies traces with both launch direction and spin axis telemetry", () => {
    const trace = buildShotShapeTrace({
      id: "full-telemetry",
      carryYd: 210,
      sideCarryYd: 24,
      launchDirectionDeg: 3,
      spinAxis: 12,
      maxCarryYd: 240,
      maxSideYd: 40,
    });

    expect(trace?.source).toBe("launch-spin");
    expect(trace?.path).toMatch(/^M 50 88 Q \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)? \d+(\.\d+)?$/);
  });
});
