import { describe, expect, it } from "vitest";

import {
  alphaForDays,
  calculateFitnessFreshnessSeries,
  calculateGolfForm,
  calculateReadiness,
} from "@/lib/training/fitnessFreshness";

describe("fitness and form calculations", () => {
  it("uses the expected EMA alphas", () => {
    expect(alphaForDays(7)).toBe(0.25);
    expect(alphaForDays(42)).toBeCloseTo(0.0465116279, 10);
  });

  it("raises fatigue faster than fitness after a load day", () => {
    const [point] = calculateFitnessFreshnessSeries([{ date: "2026-06-01", load: 100 }], {
      startDate: "2026-06-01",
      endDate: "2026-06-01",
      minimumDays: 1,
    });

    expect(point?.fatigue).toBeCloseTo(25, 3);
    expect(point?.fitness).toBeCloseTo(4.651, 3);
    expect(point?.readiness).toBeCloseTo(96, 3);
    expect(point?.form).toBe(100);
  });

  it("raises readiness when short-term load cools", () => {
    const series = calculateFitnessFreshnessSeries([{ date: "2026-06-01", load: 100 }], {
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      minimumDays: 1,
    });

    expect(series[0]?.readiness).toBeLessThan(100);
    expect(series[4]?.readiness).toBeGreaterThan(series[0]!.readiness);
    expect(calculateReadiness(0)).toBe(100);
  });

  it("uses a baseline index instead of subtracting acute load from form", () => {
    expect(calculateGolfForm(100, 118)).toBe(100);
    expect(calculateGolfForm(100, 118, 0.04)).toBe(100);
    expect(calculateGolfForm(0, 0, 0)).toBe(100);
  });

  it("starts long-range form at baseline before the first comparison signal", () => {
    const series = calculateFitnessFreshnessSeries([{ date: "2026-04-23", load: 100 }], {
      startDate: "2026-04-20",
      endDate: "2026-04-25",
      minimumDays: 1,
      formAdjustments: [{ date: "2026-04-24", adjustment: 4 }],
    });

    expect(series.slice(0, 4).map((point) => point.form)).toEqual([100, 100, 100, 100]);
    expect(series[4]?.form).toBeCloseTo(102.1, 3);
    expect(series[5]?.form).toBeCloseTo(102.1, 3);
  });

  it("can include a latest-session form adjustment", () => {
    expect(calculateGolfForm(100, 118, undefined, 6)).toBe(109);
    expect(calculateGolfForm(100, 118, undefined, -4)).toBe(94);
  });

  it("keeps form independent from fitness and acute load", () => {
    expect(calculateGolfForm(160, 0)).toBe(100);
    expect(calculateGolfForm(0, 160)).toBe(100);
    expect(calculateGolfForm(100, 100, 0.2, 20)).toBe(130);
  });

  it("raises form on a positive session-quality adjustment and holds through short quiet spells", () => {
    const series = calculateFitnessFreshnessSeries([{ date: "2026-06-01", load: 100 }], {
      startDate: "2026-06-01",
      endDate: "2026-06-04",
      minimumDays: 1,
      formAdjustments: [{ date: "2026-06-02", adjustment: 6 }],
    });

    expect(series[1]?.form).toBeGreaterThan(series[0]!.form);
    expect(series[1]?.form).toBeCloseTo(103.15, 2);
    expect(series[3]?.form).toBe(series[1]?.form);
  });

  it("only lets form fade gently back toward baseline after a longer quiet spell", () => {
    const series = calculateFitnessFreshnessSeries([{ date: "2026-06-01", load: 100 }], {
      startDate: "2026-06-01",
      endDate: "2026-06-15",
      minimumDays: 1,
      formAdjustments: [{ date: "2026-06-02", adjustment: 6 }],
    });
    const postSession = series[1]!;
    const afterGrace = series.at(-1)!;

    expect(afterGrace.form).toBeLessThan(postSession.form);
    expect(afterGrace.form).toBeGreaterThan(100);
    expect(postSession.form - afterGrace.form).toBeLessThan(0.5);
  });

  it("includes zero-load days so fatigue drops faster than fitness", () => {
    const series = calculateFitnessFreshnessSeries([{ date: "2026-06-01", load: 100 }], {
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      minimumDays: 1,
    });
    const dayOne = series[0]!;
    const dayFive = series[4]!;

    expect(series.map((point) => point.load)).toEqual([100, 0, 0, 0, 0]);
    expect(dayFive.fatigue).toBeLessThan(dayOne.fatigue);
    expect(dayFive.fitness).toBeLessThan(dayOne.fitness);
    expect(dayOne.fatigue - dayFive.fatigue).toBeGreaterThan(dayOne.fitness - dayFive.fitness);
    expect(dayFive.form).toBe(dayOne.form);
  });
});
