import { describe, expect, it } from "vitest";

import {
  buildSessionQualityByDate,
  calculateSessionQualityScore,
} from "@/lib/training/sessionQuality";
import type { SessionFormSnapshot } from "@/lib/training/sessionForm";

describe("training session quality", () => {
  it("keeps a highly playable mixed-club range session in the productive band", () => {
    const score = calculateSessionQualityScore({
      kind: "shots",
      title: "Rapsodo practice",
      sampleSize: 111,
      playableRate: 98.5,
      averageOfflineYd: 10.6,
      carryStdDevYd: 42,
    });

    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(90);
  });

  it("rates playable but loose range sessions below tighter sessions", () => {
    const tight = calculateSessionQualityScore(shotSnapshot({ averageOfflineYd: 7 }));
    const loose = calculateSessionQualityScore(shotSnapshot({ averageOfflineYd: 18 }));

    expect(tight).toBeGreaterThan(loose ?? 0);
    expect(loose).toBeGreaterThanOrEqual(60);
  });

  it("builds one weighted quality point for days with scored session snapshots", () => {
    const scores = buildSessionQualityByDate([
      { date: "2026-07-08", snapshot: shotSnapshot({ sampleSize: 100, averageOfflineYd: 8 }) },
      {
        date: "2026-07-08",
        snapshot: {
          kind: "round",
          title: "9-hole round",
          sampleSize: 9,
          scoreToParPer18: 10,
        },
      },
      {
        date: "2026-07-09",
        snapshot: {
          kind: "load",
          title: "Manual load",
          sampleSize: 1,
          sessionLoad: 100,
        },
      },
    ]);

    expect(scores.get("2026-07-08")).toBeGreaterThan(70);
    expect(scores.has("2026-07-09")).toBe(false);
  });
});

function shotSnapshot(overrides: Partial<SessionFormSnapshot> = {}): SessionFormSnapshot {
  return {
    kind: "shots",
    title: "Rapsodo practice",
    sampleSize: 80,
    playableRate: 96,
    averageOfflineYd: 10,
    carryStdDevYd: 16,
    ...overrides,
  };
}
