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

  it("builds a straight landing line when start telemetry is unavailable", () => {
    const trace = buildShotShapeTrace({
      id: "landing-only",
      carryYd: 180,
      sideCarryYd: -20,
      maxCarryYd: 240,
      maxSideYd: 40,
    });

    expect(trace).toMatchObject({
      source: "straight",
      landingX: 31,
      landingY: 34,
      curveYd: null,
    });
    expect(trace?.path).toBe("M 50 88 L 31 34");
  });

  it("does not infer a curve from spin axis without launch direction", () => {
    const trace = buildShotShapeTrace({
      id: "spin-only",
      carryYd: 180,
      sideCarryYd: 20,
      spinAxis: 18,
      maxCarryYd: 240,
      maxSideYd: 40,
    });

    expect(trace?.source).toBe("straight");
    expect(trace?.curveYd).toBeNull();
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

    expect(trace?.source).toBe("estimated");
    expect(trace?.curveYd).toBeGreaterThan(50);
    expect(trace?.landingX).toBeGreaterThan(50);
    expect(firstLineX(trace?.path)).toBeLessThan(50);
  });

  it("keeps the estimated curve tied to launch direction when spin axis is also present", () => {
    const trace = buildShotShapeTrace({
      id: "full-telemetry",
      carryYd: 210,
      sideCarryYd: 24,
      launchDirectionDeg: 3,
      spinAxis: 12,
      maxCarryYd: 240,
      maxSideYd: 40,
    });

    expect(trace?.source).toBe("estimated");
    expect(trace?.curveYd).toBeLessThan(14);
    expect(trace?.path).toMatch(/^M 50 88 L \d+(\.\d+)? \d+(\.\d+)? L \d+(\.\d+)? \d+(\.\d+)?/);
  });
});

function firstLineX(path: string | undefined) {
  const [, , , , x] = path?.split(" ") ?? [];
  return Number(x);
}
