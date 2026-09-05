import { describe, expect, it } from "vitest";
import { speedElapsedMs, speedFatigueStop } from "./mobile-speed-progress";

describe("mobile speed progress", () => {
  it("preserves elapsed activity across a pause without counting paused time", () => {
    const paused = speedElapsedMs(0, 1_000, 11_000);
    expect(speedElapsedMs(paused, null, 90_000)).toBe(10_000);
    expect(speedElapsedMs(paused, 90_000, 95_000)).toBe(15_000);
    expect(speedElapsedMs(paused, 90_000, 80_000)).toBe(10_000);
  });
  it("uses two maximum readings below the existing 4% stop threshold", () => {
    const readings = [100, 96, 95].map((value) => ({ value, warmup: false }));
    expect(speedFatigueStop(readings)).toBe(true);
    expect(speedFatigueStop(readings.slice(0, 2))).toBe(false);
    expect(speedFatigueStop([...readings, { value: 99, warmup: false }])).toBe(true);
    expect(speedFatigueStop([...readings, { value: 105, warmup: false }])).toBe(true);
  });
  it("does not retrospectively treat a progressive build as fatigue", () => {
    expect(speedFatigueStop([90, 91, 100].map((value) => ({ value, warmup: false })))).toBe(false);
  });
  it("does not treat progressive warm-up or unmeasured values as evidence of fatigue", () => {
    expect(
      speedFatigueStop([
        { value: 100, warmup: false },
        { value: 70, warmup: true },
        { value: 75, warmup: true },
      ]),
    ).toBe(false);
    expect(
      speedFatigueStop([
        { value: 100, warmup: false },
        { value: NaN, warmup: false },
        { value: 95, warmup: false },
      ]),
    ).toBe(false);
  });
});
