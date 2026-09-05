import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheActivePractice, readActivePractice } from "./practice-companion-client";
import {
  parsePracticeActivityProgress,
  savedPracticePlanToPracticePlan,
  type PracticePlan,
  type SavedPracticePlan,
} from "@/lib/practice-planner";

vi.mock("./actions", () => ({}));
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("practice activity recovery", () => {
  it("preserves pause, completion, plan and ball state when updating only a note or block", () => {
    const plan = { id: "a", blocks: [] } as unknown as PracticePlan;
    cacheActivePractice("owner", "a", ["block-one"], "Original", 2, plan, true, { two: 5 }, true);
    cacheActivePractice("owner", "a", ["block-one"], "Updated", 3);
    expect(readActivePractice("owner")).toMatchObject({
      planId: "a",
      plan,
      finished: true,
      paused: true,
      remainingBalls: { two: 5 },
      note: "Updated",
      blockIndex: 3,
      completedBlockIds: ["block-one"],
    });
  });
  it("never carries another plan's state into a new activity or another account", () => {
    cacheActivePractice(
      "owner",
      "a",
      ["one"],
      "A",
      2,
      { id: "a" } as PracticePlan,
      true,
      { one: 2 },
      true,
    );
    cacheActivePractice("owner", "b", [], "B", 0);
    expect(readActivePractice("owner")).toMatchObject({
      planId: "b",
      finished: false,
      paused: false,
      remainingBalls: {},
    });
    expect(readActivePractice("owner")?.plan).toBeUndefined();
    expect(readActivePractice("different-owner")).toBeNull();
  });
  it("recovers legacy caches and rejects corrupt indexes and ball counts", () => {
    values.set(
      "fkh:active-practice:owner",
      JSON.stringify({
        planId: "a",
        blockIndex: -4.5,
        completedBlockIds: ["one", 3],
        remainingBalls: { one: -1, two: 8 },
      }),
    );
    expect(readActivePractice("owner")).toMatchObject({
      blockIndex: 0,
      paused: false,
      completedBlockIds: ["one"],
      remainingBalls: { two: 8 },
    });
    values.set("fkh:active-practice:owner", "broken");
    expect(readActivePractice("owner")).toBeNull();
  });
  it("exposes saved server progress through the existing plan conversion without creating measured results", () => {
    const progress = parsePracticeActivityProgress({
      blockIndex: 2,
      completedBlockIds: ["one"],
      note: "Saved strike note",
    });
    expect(progress).toEqual({
      blockIndex: 2,
      completedBlockIds: ["one"],
      note: "Saved strike note",
    });
    const saved = {
      id: "a",
      status: "awaiting_import",
      focusClubs: [],
      blocks: [],
      plannedAt: "2026-09-05T10:00:00Z",
      activityProgress: progress,
    } as unknown as SavedPracticePlan;
    const plan = savedPracticePlanToPracticePlan(saved);
    expect(plan.activityProgress).toEqual(progress);
    expect(plan.status).toBe("awaiting_import");
    expect(parsePracticeActivityProgress({ blockIndex: "two" })).toBeNull();
  });
});
