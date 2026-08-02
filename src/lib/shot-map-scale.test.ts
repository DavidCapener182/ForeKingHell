import { describe, expect, it } from "vitest";

import {
  SHOT_MAP_DISTANCE_GUIDE_YARDS,
  SHOT_MAP_MAX_CARRY_YD,
  SHOT_MAP_MAX_SIDE_YD,
  shotMapPointForYards,
} from "@/lib/shot-map-scale";

describe("shot map scale", () => {
  it("keeps every filtered view on a fixed 0-250 yd and +/-75 yd frame", () => {
    expect(SHOT_MAP_MAX_CARRY_YD).toBe(250);
    expect(SHOT_MAP_MAX_SIDE_YD).toBe(75);
    expect(SHOT_MAP_DISTANCE_GUIDE_YARDS).toEqual([50, 75, 100, 150, 200, 250]);

    expect(shotMapPointForYards({ carryYd: 50, sideCarryYd: 0 }).y).toBeCloseTo(73.6);
    expect(shotMapPointForYards({ carryYd: 250, sideCarryYd: 0 }).y).toBe(16);
    expect(shotMapPointForYards({ carryYd: 150, sideCarryYd: -75 }).x).toBe(12);
    expect(shotMapPointForYards({ carryYd: 150, sideCarryYd: 75 }).x).toBe(88);
  });
});
