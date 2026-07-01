import { describe, expect, it, vi } from "vitest";

import { compassLabel, fetchOpenMeteoSnapshot } from "@/lib/plays-like-weather";

describe("plays-like weather provider", () => {
  it("maps Open-Meteo forecast and elevation responses into a plays-like snapshot", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = input instanceof URL ? input : new URL(String(input));

      if (url.pathname.includes("elevation")) {
        return jsonResponse({ elevation: [153] });
      }

      return jsonResponse({
        current: {
          temperature_2m: 16.4,
          relative_humidity_2m: 72,
          wind_speed_10m: 11.6,
          wind_direction_10m: 225,
        },
      });
    });

    const snapshot = await fetchOpenMeteoSnapshot({
      latitude: 51.5,
      longitude: -0.1,
      now: new Date("2026-07-01T09:00:00Z"),
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(snapshot.provider).toBe("open_meteo");
    expect(snapshot.conditions).toMatchObject({
      temperatureC: 16.4,
      humidityPct: 72,
      windSpeedMph: 11.6,
      windDirectionLabel: "SW",
      altitudeM: 153,
    });
    expect(snapshot.expiresAt).toBe("2026-07-01T09:30:00.000Z");
  });

  it("formats compass labels from provider degrees", () => {
    expect(compassLabel(0)).toBe("N");
    expect(compassLabel(90)).toBe("E");
    expect(compassLabel(225)).toBe("SW");
    expect(compassLabel(359)).toBe("N");
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
