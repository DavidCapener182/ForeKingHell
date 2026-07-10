import { describe, expect, it } from "vitest";

import {
  feetToDisplay,
  formatStoredApexFeet,
  formatStoredLateralYards,
  formatStoredSpeedMph,
  formatStoredYards,
  lateralDirection,
  mphToDisplay,
  parseDateOnlyLocal,
  safePercentage,
  yardsToDisplay,
} from "@/lib/units";

describe("central unit and numeric integrity", () => {
  it("converts stored imperial values only at the display boundary", () => {
    expect(yardsToDisplay(100, "yards")).toBe(100);
    expect(yardsToDisplay(100, "metres")).toBeCloseTo(91.44, 6);
    expect(feetToDisplay(100, "metres")).toBeCloseTo(30.48, 6);
    expect(mphToDisplay(100, "kph")).toBeCloseTo(160.9344, 6);
  });

  it("preserves zero, negative lateral values and null separately", () => {
    expect(formatStoredYards(0, "yards")).toBe("0 yd");
    expect(formatStoredYards(-12, "metres")).toBe("-11 m");
    expect(formatStoredYards(null, "yards")).toBe("—");
    expect(formatStoredApexFeet(100, "metres")).toBe("30.5 m");
    expect(formatStoredSpeedMph(100, "metres")).toBe("160.9 kph");
    expect(formatStoredLateralYards(-10, "metres")).toBe("9.1 m L");
  });

  it("keeps target-line and handedness-relative signs explicit", () => {
    expect(lateralDirection(-10, "target-line", "left")).toBe("left");
    expect(lateralDirection(-10, "golfer-relative", "right")).toBe("pull");
    expect(lateralDirection(-10, "golfer-relative", "left")).toBe("push");
    expect(lateralDirection(0, "target-line", "right")).toBe("centre");
  });

  it("does not invent percentages for empty samples", () => {
    expect(safePercentage(0, 0)).toBeNull();
    expect(safePercentage(1, 4)).toBe(25);
  });

  it("parses date-only sessions in local time without a UTC date shift", () => {
    const date = parseDateOnlyLocal("2026-03-29");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(29);
    expect(parseDateOnlyLocal("2026-02-31")).toBeNull();
  });
});
