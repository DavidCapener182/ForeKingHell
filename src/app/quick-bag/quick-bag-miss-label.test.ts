import { describe, expect, it } from "vitest";
import { quickBagMissLabel } from "./quick-bag-miss-label";
const club = { medianLateralYd: -8, typicalMiss: "8 yd left", widerSide: null };
describe("Quick Bag measured miss units", () => {
  it("converts canonical measured lateral distance with the selected display unit", () => {
    expect(quickBagMissLabel(club, "yards")).toBe("8 yd left");
    expect(quickBagMissLabel(club, "metres")).toBe("7 m left");
    expect(quickBagMissLabel({ ...club, medianLateralYd: 8 }, "metres")).toBe("7 m right");
  });
  it("preserves the canonical near-target threshold across unit switches", () => {
    expect(quickBagMissLabel({ ...club, medianLateralYd: 0 }, "metres")).toBe("Near target");
    expect(quickBagMissLabel({ ...club, medianLateralYd: 3.9 }, "yards")).toBe("Near target");
    expect(quickBagMissLabel({ ...club, medianLateralYd: 4 }, "metres")).toBe("4 m right");
  });
  it("does not invent a zero lateral measurement when evidence is absent", () => {
    expect(
      quickBagMissLabel({ medianLateralYd: null, typicalMiss: null, widerSide: null }, "metres"),
    ).toBe("Not established");
  });
});
