import { describe, expect, it } from "vitest";

import { shouldPersistProgressCandidate } from "./service";
import { ACHIEVEMENT_REGISTRY_VERSION } from "./registry";

function progressCandidate(achievementId: string) {
  return {
    achievementId,
    progressValue: 0,
    targetValue: 1,
  };
}

describe("achievement progress persistence", () => {
  it("persists generated club distance ladders without persisting every generated counter", () => {
    expect(shouldPersistProgressCandidate(progressCandidate("club_driver_carry_260"))).toBe(true);
    expect(shouldPersistProgressCandidate(progressCandidate("club_driver_total_290"))).toBe(true);
    expect(shouldPersistProgressCandidate(progressCandidate("club_driver_volume_100"))).toBe(false);
  });

  it("forces existing achievement progress to resynchronise", () => {
    expect(ACHIEVEMENT_REGISTRY_VERSION).toBe("2026-08-13-club-metric-progress-v1");
  });
});
