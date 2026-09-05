import { describe, expect, it } from "vitest";
import {
  parseQuickRangeDraft,
  updateQuickRangeDraft,
  type QuickRangeDraft,
} from "./quick-range-draft";

const ready: QuickRangeDraft = {
  state: "ready",
  club: "7 Iron",
  focus: "Start line",
  balls: 20,
  count: 0,
  target: "",
  notes: "",
  labels: [],
  elapsed: 0,
};
const start = "2026-09-05T09:00:00.000Z";
const finish = "2026-09-05T09:12:00.000Z";

describe("Quick Range review later", () => {
  it("keeps completed activity and its latest note after a new session starts", () => {
    const active = updateQuickRangeDraft(ready, { state: "active" }, start);
    const done = updateQuickRangeDraft(
      { ...active, count: 2, labels: ["Playable", "Left"], elapsed: 720 },
      { state: "finished", notes: "Start left of the flag" },
      finish,
    );
    const edited = updateQuickRangeDraft(
      done,
      { notes: "Repeat the same target" },
      "2026-09-05T09:13:00.000Z",
    );
    const next = updateQuickRangeDraft(
      edited,
      { state: "ready", count: 0, labels: [], elapsed: 0, notes: "" },
      finish,
    );
    const started = updateQuickRangeDraft(next, { state: "active" }, "2026-09-05T10:00:00.000Z");
    expect(started.history).toHaveLength(1);
    expect(started.history?.[0]).toMatchObject({
      id: start,
      finishedAt: finish,
      count: 2,
      notes: "Repeat the same target",
      labels: ["Playable", "Left"],
    });
    expect(started.activityId).not.toBe(start);
    expect(started.count).toBe(0);
    expect(parseQuickRangeDraft(JSON.parse(JSON.stringify(started)))).toEqual(started);
  });

  it("retains legacy finished notes without inventing a completion date", () => {
    const current = { ...ready, state: "finished" as const, notes: "Legacy note", count: 12 };
    const next = updateQuickRangeDraft(current, { state: "ready", notes: "" }, finish);
    expect(next.history?.[0]).toMatchObject({ finishedAt: null, notes: "Legacy note", count: 12 });
  });

  it("bounds malformed local values and ignores invalid or duplicate history", () => {
    const current = updateQuickRangeDraft(
      { ...ready, activityId: start },
      { state: "finished" },
      finish,
    );
    const parsed = parseQuickRangeDraft({
      ...current,
      count: -2.5,
      elapsed: -1,
      notes: "x".repeat(900),
      labels: ["Right", {}, "fake"],
      history: [null, ...current.history!, ...current.history!, { bad: true }],
    });
    expect(parsed).toMatchObject({ count: 0, elapsed: 0 });
    expect(parsed?.notes).toHaveLength(500);
    expect(parsed?.labels).toEqual([]);
    expect(parsed?.history).toHaveLength(1);
    expect(parseQuickRangeDraft({ ...ready, elapsed: Infinity })).toBeNull();
    expect(parseQuickRangeDraft({ ...ready, state: "unknown" })).toBeNull();
  });

  it("keeps the newest 50 records and replaces edits instead of duplicating a finish", () => {
    let draft = ready;
    for (let i = 0; i < 55; i++) {
      draft = updateQuickRangeDraft(
        { ...draft, state: "active", activityId: `activity-${i}` },
        { state: "finished" },
        finish,
      );
    }
    expect(draft.history).toHaveLength(50);
    expect(draft.history?.[0].id).toBe("activity-54");
    expect(draft.history?.at(-1)?.id).toBe("activity-5");
    expect(updateQuickRangeDraft(draft, { notes: "Edited" }, finish).history).toHaveLength(50);
  });
});
