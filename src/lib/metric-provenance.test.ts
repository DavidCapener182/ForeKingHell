import { describe, expect, it } from "vitest";
import {
  normalizeMetricReading,
  derivePairedSmash,
  type MetricReading,
} from "@/lib/metric-provenance";
const fixture = (overrides: Partial<MetricReading> = {}): MetricReading => ({
  metric: "apexYd",
  value: 90,
  unit: "ft",
  status: "measured",
  source: "synthetic-test-device",
  adapterVersion: "fixture-v1",
  observationId: "synthetic-shot-1",
  ...overrides,
});
describe("metric-level normalization and provenance", () => {
  it("converts apex feet once and preserves the raw observation", () => {
    const normalized = normalizeMetricReading(fixture());
    expect(normalized).toMatchObject({
      value: 30,
      unit: "yd",
      rawValue: 90,
      rawUnit: "ft",
      comparable: true,
    });
    expect(normalizeMetricReading(normalized)).toEqual(normalized);
    expect(normalizeMetricReading(fixture({ value: 30, unit: "yd" })).value).toBe(30);
  });
  it("blocks ambiguous apex units and unknown flags rather than assuming measurements", () => {
    const unresolved = normalizeMetricReading(fixture({ unit: "unknown" }));
    expect(normalizeMetricReading(unresolved)).toEqual(unresolved);
    expect(unresolved).toMatchObject({
      value: null,
      status: "unknown",
      comparable: false,
    });
    expect(normalizeMetricReading(fixture({ manufacturerFlag: 77 }))).toMatchObject({
      value: 30,
      status: "unknown",
      comparable: false,
    });
  });
  it("preserves measured zero spin axis and legitimate negative angles including -1", () => {
    expect(
      normalizeMetricReading(fixture({ metric: "spinAxisDeg", value: 0, unit: "deg" })).value,
    ).toBe(0);
    for (const metric of ["attackAngleDeg", "pathDeg"] as const)
      expect(normalizeMetricReading(fixture({ metric, value: -1, unit: "deg" }))).toMatchObject({
        value: -1,
        comparable: true,
      });
  });
  it("keeps missing spin missing and isolates carry invalidity from valid speed", () => {
    expect(
      normalizeMetricReading(fixture({ metric: "spinRate", value: null, unit: "rpm" })).value,
    ).toBeNull();
    expect(
      normalizeMetricReading(fixture({ metric: "carryYd", value: 0, unit: "yd" })).status,
    ).toBe("invalid");
    expect(
      normalizeMetricReading(fixture({ metric: "ballSpeedMph", value: 135, unit: "mph" })),
    ).toMatchObject({ value: 135, comparable: true });
  });
  it("returns a separate derived paired smash without overwriting imported smash", () => {
    const imported = fixture({ metric: "smashFactor", value: 1.48, unit: "ratio" });
    const derived = derivePairedSmash(
      fixture({ metric: "ballSpeedMph", value: 135, unit: "mph" }),
      fixture({ metric: "clubSpeedMph", value: 91.1, unit: "mph" }),
    );
    expect(derived.status).toBe("derived");
    expect(derived.value).toBeCloseTo(135 / 91.1);
    expect(imported.value).toBe(1.48);
  });
  it("does not pair incompatible source or unknown speed observations", () => {
    const ball = fixture({ metric: "ballSpeedMph", value: 135, unit: "mph" });
    expect(
      derivePairedSmash(
        ball,
        fixture({ metric: "clubSpeedMph", value: 90, unit: "mph", source: "other" }),
      ).value,
    ).toBeNull();
    expect(
      derivePairedSmash(
        ball,
        fixture({
          metric: "clubSpeedMph",
          value: 90,
          unit: "mph",
          observationId: "different-shot",
        }),
      ).value,
    ).toBeNull();
    expect(
      derivePairedSmash(
        ball,
        fixture({ metric: "clubSpeedMph", value: 90, unit: "mph", status: "unknown" }),
      ).value,
    ).toBeNull();
  });
});
