import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeasonGoal } from "@/lib/product-preferences-model";

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  writes: [] as Record<string, unknown>[],
  operations: [] as string[],
}));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    transaction: async (operation: (db: unknown) => Promise<void>) => {
      state.operations.push("transaction");
      await operation({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: async (mode: string) => {
                  state.operations.push(`lock:${mode}`);
                  return [{ settings: state.settings }];
                },
              }),
            }),
          }),
        }),
        insert: () => ({
          values: (values: Record<string, unknown>) => ({
            onConflictDoNothing: async () => {
              state.operations.push("ensure-row");
            },
            onConflictDoUpdate: async () => {
              state.operations.push("write");
              state.writes.push(values);
            },
          }),
        }),
      });
    },
  }),
}));

import { updateProductPreferences } from "@/lib/product-preferences";

const goal: SeasonGoal = {
  id: "carry",
  type: "carry",
  title: "Carry",
  club: "driver",
  startingValue: 190,
  currentValue: 195,
  targetValue: 210,
  unit: "yd",
  targetDate: "",
  evidenceSource: "Saved value",
  nextAction: "Practise",
};

describe("goal history persistence", () => {
  beforeEach(() => {
    state.settings = { goals: [goal], existingFeatureSetting: true };
    state.writes = [];
    state.operations = [];
  });
  it("stores the value change with the preferences under the same row lock", async () => {
    await updateProductPreferences("owner", { goals: [{ ...goal, currentValue: 200 }] });
    expect(state.operations).toEqual(["transaction", "ensure-row", "lock:update", "write"]);
    expect(state.writes[0]).toMatchObject({
      userId: "owner",
      highlightSettingsJson: {
        existingFeatureSetting: true,
        goals: [{ currentValue: 200 }],
        goalMovements: [{ from: 195, to: 200, goalId: "carry" }],
      },
    });
  });
  it("preserves movement history when a different preference changes", async () => {
    state.settings.goalMovements = [{ id: "existing" }];
    await updateProductPreferences("owner", {
      seasonPlan: {
        outcome: "Break 80",
        targetDate: "",
        focus: "Approach",
        weeklySessions: 2,
        successMeasure: "Scoring",
      },
    });
    expect(state.writes[0]).toMatchObject({
      highlightSettingsJson: {
        goals: [goal],
        goalMovements: [{ id: "existing" }],
        existingFeatureSetting: true,
      },
    });
  });
});
