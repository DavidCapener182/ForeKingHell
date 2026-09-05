import { describe, expect, it } from "vitest";
import {
  mobileSpeedBlocks,
  mobileSpeedPrescription,
  restoreMobileSpeedBlock,
} from "./mobile-speed-plan";
import type { SpeedDevelopmentSummary } from "./speed-development";
const plan: SpeedDevelopmentSummary["plan"] = {
  title: "Today’s Speed Session",
  durationMinutes: 20,
  mode: "speed",
  blocks: [
    {
      key: "warmup",
      label: "Warm-up",
      reps: 6,
      balls: null,
      target: "70 → 80 → 90%",
      instruction: "Six progressive swings",
    },
    {
      key: "speed-1",
      label: "Speed Block 1",
      reps: 5,
      balls: null,
      target: "90 mph intent",
      instruction: "Five maximum swings",
    },
    {
      key: "speed-2",
      label: "Speed Block 2",
      reps: 5,
      balls: null,
      target: "Beat Block 1 peak",
      instruction: "Rest 60–90 seconds",
    },
    {
      key: "transfer",
      label: "Driver transfer",
      reps: null,
      balls: 5,
      target: "Speed + strike + playable",
      instruction: "Bring speed to the ball",
    },
    {
      key: "finish",
      label: "Normal finish",
      reps: null,
      balls: 3,
      target: "Course routine",
      instruction: "No speed chasing",
    },
  ],
};
describe("mobile speed stages", () => {
  it("makes build and maximum intent explicit without adding prescribed swings", () => {
    const blocks = mobileSpeedBlocks(plan);
    expect(blocks.map((b) => b.key)).toEqual([
      "warmup",
      "build",
      "speed-1",
      "speed-2",
      "transfer",
      "finish",
    ]);
    expect(blocks.reduce((n, b) => n + (b.reps ?? 0) + (b.balls ?? 0), 0)).toBe(24);
    expect(blocks.filter((b) => b.warmup).reduce((n, b) => n + (b.reps ?? 0), 0)).toBe(6);
    expect(blocks.find((b) => b.key === "speed-2")?.instruction).toBe("Rest 60–90 seconds");
    expect(plan.blocks).toHaveLength(5);
  });
  it("never turns a recovery or controlled transfer day into maximum speed work", () => {
    for (const mode of ["technical", "transfer"] as const) {
      const blocks = mobileSpeedBlocks({
        ...plan,
        mode,
        blocks: [plan.blocks[0], plan.blocks[3], plan.blocks[4]],
      });
      expect(blocks).toHaveLength(3);
      expect(blocks.every((b) => b.warmup)).toBe(true);
    }
  });
  it("restores an older block index by its original identity after the build stage is inserted", () => {
    expect(restoreMobileSpeedBlock(plan, { block: 2 })).toBe(3);
    expect(restoreMobileSpeedBlock(plan, { block: 1, blockKey: "build", version: 2 })).toBe(1);
    expect(restoreMobileSpeedBlock(plan, { block: Infinity })).toBe(0);
  });
});

describe("linked transfer priority", () => {
  it("removes maximum work after an explicit failed transfer without adding swings", () => {
    const adjusted = mobileSpeedPrescription({ plan, verdict: { playabilityPassed: false } });
    expect(adjusted.mode).toBe("transfer");
    expect(adjusted.blocks.map((b) => b.key)).toEqual(["warmup", "transfer", "finish"]);
    expect(plan.blocks).toHaveLength(5);
  });
  it("preserves recovery plans and does not manufacture failure from absent evidence", () => {
    const technical = { ...plan, mode: "technical" as const };
    expect(
      mobileSpeedPrescription({ plan: technical, verdict: { playabilityPassed: false } }),
    ).toBe(technical);
    expect(mobileSpeedPrescription({ plan, verdict: null })).toBe(plan);
    expect(mobileSpeedPrescription({ plan, verdict: { playabilityPassed: true } })).toBe(plan);
  });
});
