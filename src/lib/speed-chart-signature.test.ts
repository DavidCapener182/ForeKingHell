import { describe, expect, it } from "vitest";

import { buildSpeedChartSignature } from "@/lib/speed-chart-signature";

describe("speed chart signature", () => {
  it("builds target bands, PB markers and recent ghost averages", () => {
    const signature = buildSpeedChartSignature({
      points: [
        { label: "Mon", value: 91 },
        { label: "Wed", value: 93 },
        { label: "Fri", value: 94 },
      ],
      targetSpeedMph: 96,
      personalBestMph: 97,
    });

    expect(signature.targetBand).toEqual({ low: 94.5, high: 97.5, target: 96 });
    expect(signature.personalBest).toEqual({ label: "PB", value: 97 });
    expect(signature.ghostAverage).toBe(92.7);
  });
});
