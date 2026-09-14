import { describe, expect, it } from "vitest";
import { practiceSampleContext, stablePracticeReadout } from "./practice-comparison-readout";

const driver = { carry: -0.5, ballSpeed: 0.1, offline: 1.9, carrySpread: 3.6 };
describe("descriptive practice readouts", () => {
  it("separates the supplied driver's stable distance and speed from wider dispersion", () => {
    expect(stablePracticeReadout(driver)).toBe(
      "Distance and speed stable — dispersion slightly wider",
    );
    expect(practiceSampleContext(33, 10)).toContain("shot count alone does not explain");
  });
  it("does not soften substantial dispersion changes, carry losses or missing evidence", () => {
    expect(stablePracticeReadout({ ...driver, offline: 8 })).toBeNull();
    expect(stablePracticeReadout({ ...driver, carry: -10.4 })).toBeNull();
    expect(stablePracticeReadout({ ...driver, ballSpeed: null })).toBeNull();
    expect(stablePracticeReadout({ ...driver, carry: NaN })).toBeNull();
  });
  it("preserves strong consistency gains rather than calling them stable", () => {
    expect(
      stablePracticeReadout({ carry: 0, ballSpeed: 0, offline: -0.2, carrySpread: -7.5 }),
    ).toBeNull();
  });
  it("flags small samples and handles unequal samples in either direction", () => {
    expect(practiceSampleContext(7, 8)).toContain("early signal");
    expect(practiceSampleContext(10, 33)).toBe(practiceSampleContext(33, 10));
    expect(practiceSampleContext(20, 20)).toBe("");
    expect(practiceSampleContext(0, 20)).not.toContain("Unequal");
  });
});
