import { describe, expect, it } from "vitest";

import { buildDangerHeatSummary, buildDispersionEllipse } from "@/lib/shot-pattern-signature";

describe("shot-pattern signature helpers", () => {
  it("builds a stable dispersion ellipse from included shots", () => {
    const ellipse = buildDispersionEllipse([
      { forwardYd: 190, sideYd: -12, included: true },
      { forwardYd: 200, sideYd: -4, included: true },
      { forwardYd: 205, sideYd: 5, included: true },
      { forwardYd: 215, sideYd: 12, included: true },
      { forwardYd: 260, sideYd: 60, included: false },
    ]);

    expect(ellipse).toMatchObject({
      centerForwardYd: 202.5,
      centerSideYd: 0.5,
      sampleSize: 4,
    });
    expect(ellipse?.radiusForwardYd).toBeGreaterThan(8);
    expect(ellipse?.radiusSideYd).toBeGreaterThanOrEqual(6);
  });

  it("summarizes heat risk from trouble outcomes", () => {
    const heat = buildDangerHeatSummary([
      { forwardYd: 180, sideYd: -20, surface: "trouble", included: true },
      { forwardYd: 190, sideYd: -15, surface: "trouble", included: true },
      { forwardYd: 205, sideYd: 4, surface: "playable", included: true },
      { forwardYd: 210, sideYd: 10, surface: "playable", included: true },
    ]);

    expect(heat.riskScore).toBe(50);
    expect(heat.dominantMiss).toBe("left");
  });
});
