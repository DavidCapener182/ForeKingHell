import { describe, expect, it } from "vitest";
import {
  calibrationCandidates,
  medianMetric,
  monitorConditions,
  sourceNormalisation,
  type CalibrationShot,
} from "./launch-monitor-calibration";
import { isDesktopOnlyCompanionPath } from "./app-route-capabilities";

const shot: CalibrationShot = {
  id: "source",
  shotNumber: 1,
  clubType: "driver",
  reviewStatus: "included",
  sourceRawJson: {},
  ballSpeedMph: 130,
  clubSpeedMph: 88,
  launchAngleDeg: 12,
  carryYd: 200,
  totalYd: 220,
  spinRate: null,
  sideCarryYd: 5,
};
describe("website calibration evidence", () => {
  it("preserves missing values and returns medians with actual metric counts", () => {
    expect(medianMetric([], "carryYd")).toEqual({ count: 0, value: null });
    expect(
      medianMetric([shot, { ...shot, carryYd: null }, { ...shot, carryYd: 210 }], "carryYd"),
    ).toEqual({ count: 2, value: 205 });
    expect(medianMetric([shot], "spinRate")).toEqual({ count: 0, value: null });
  });
  it("keeps ambiguous candidates without using carry or spin to pick a winner", () => {
    const reference = [
      { ...shot, id: "t1", carryYd: 180 },
      { ...shot, id: "t2", carryYd: 225 },
    ];
    expect(calibrationCandidates([shot], reference)[0].candidates).toHaveLength(2);
    expect(shot.carryYd).toBe(200);
    expect(
      calibrationCandidates([{ ...shot, clubSpeedMph: null }], reference)[0].candidates,
    ).toEqual([]);
    expect(calibrationCandidates([{ ...shot, clubType: "5i" }], reference)[0].candidates).toEqual(
      [],
    );
  });
  it("does not turn unknown normalisation into off, or unknown ball into RPT", () => {
    expect(
      sourceNormalisation([shot, { ...shot, sourceRawJson: { normalise_setting: "on" } }]),
    ).toEqual({ on: 1, off: 0, unknown: 1 });
    expect(
      monitorConditions({ environment: "outdoor", ballType: "bogus", recording: "partial" }),
    ).toEqual({
      environment: "outdoor",
      ballType: "unknown",
      recording: "partial",
      normalised: "unknown",
      ballConversion: "unknown",
    });
    expect(monitorConditions(null).normalised).toBe("unknown");
  });
  it("allows the calibration page on the phone companion", () => {
    expect(isDesktopOnlyCompanionPath("/equipment/launch-monitors/calibration")).toBe(false);
  });
});
