import { describe, expect, it } from "vitest";

import { calculatePlaysLikeYards, parsePlaysLikeConditions } from "@/lib/plays-like";

describe("plays-like calculations", () => {
  it("adjusts trusted yardages for cold, altitude and headwind conditions", () => {
    const adjustment = calculatePlaysLikeYards(160, {
      temperatureC: 8,
      altitudeM: 300,
      humidityPct: 40,
      windSpeedMph: 12,
      windEffect: "hurting",
    });

    expect(adjustment?.playsLikeYards).toBeGreaterThan(160);
    expect(adjustment?.components.windYards).toBeGreaterThan(0);
    expect(adjustment?.confidence).toBe("measured");
  });

  it("parses legacy session weather strings and structured live fields", () => {
    expect(
      parsePlaysLikeConditions({
        temperature: "52 F",
        wind: "14 mph headwind",
        humidity_pct: 62,
        altitude_m: 110,
      }),
    ).toMatchObject({
      windEffect: "hurting",
      windSpeedMph: 14,
      humidityPct: 62,
      altitudeM: 110,
    });

    expect(
      parsePlaysLikeConditions({
        temperatureC: 19,
        windSpeedMph: 8,
        windDirectionLabel: "SW",
      }),
    ).toMatchObject({
      temperatureC: 19,
      windSpeedMph: 8,
      windDirectionLabel: "SW",
    });
  });

  it("returns null for missing or invalid base yardages", () => {
    expect(calculatePlaysLikeYards(null, {})).toBeNull();
    expect(calculatePlaysLikeYards(0, {})).toBeNull();
  });
});
