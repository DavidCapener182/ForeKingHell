import { describe, expect, it } from "vitest";
import { readGoalMovements, recordGoalMovements } from "@/lib/goal-movement";
import type { SeasonGoal } from "@/lib/product-preferences-model";

const now = new Date("2026-09-05T09:00:00Z");
const goal: SeasonGoal = {
  id: "driver",
  type: "carry",
  title: "Driver carry",
  club: "driver",
  startingValue: 190,
  currentValue: 195,
  targetValue: 210,
  unit: "yd",
  targetDate: "",
  evidenceSource: "Manual review",
  nextAction: "Practise",
};

describe("recorded goal movement", () => {
  it("records the saved before/after value without claiming measured improvement", () => {
    expect(recordGoalMovements([goal], [{ ...goal, currentValue: 191 }], [], now)).toEqual([
      {
        id: "driver:2026-09-05T09:00:00.000Z",
        goalId: "driver",
        title: "Driver carry",
        from: 195,
        to: 191,
        unit: "yd",
        recordedAt: now.toISOString(),
      },
    ]);
  });
  it("does not invent history for a new goal or repeated save", () => {
    expect(recordGoalMovements([], [goal], [], now)).toEqual([]);
    expect(recordGoalMovements([goal], [{ ...goal, title: "Updated title" }], [], now)).toEqual([]);
  });
  it("does not compare different units, clubs or goal types", () => {
    for (const change of [{ unit: "m" }, { club: "7i" }, { type: "speed" as const }]) {
      expect(
        recordGoalMovements([goal], [{ ...goal, ...change, currentValue: 200 }], [], now),
      ).toEqual([]);
    }
  });
  it("retains a bounded history and removes a deleted goal's history", () => {
    const event = recordGoalMovements([goal], [{ ...goal, currentValue: 200 }], [], now)[0]!;
    expect(recordGoalMovements([goal], [goal], Array(60).fill(event), now)).toHaveLength(48);
    expect(recordGoalMovements([goal], [], [event], now)).toEqual([]);
  });
  it("rejects malformed stored events and non-finite values", () => {
    const event = recordGoalMovements([goal], [{ ...goal, currentValue: 200 }], [], now)[0]!;
    expect(
      readGoalMovements([
        null,
        { ...event, recordedAt: "bad" },
        { ...event, from: "195" },
        { ...event, to: Infinity },
        event,
      ]),
    ).toEqual([event]);
    expect(recordGoalMovements([goal], [{ ...goal, currentValue: NaN }], [], now)).toEqual([]);
  });
});
