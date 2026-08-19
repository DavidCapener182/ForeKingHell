import { describe, expect, it } from "vitest";

import {
  deriveSessionHistoryView,
  pruneSessionComparisonSelection,
} from "@/app/sessions/session-history-view";
import { resolveSessionHistorySearchParams } from "@/lib/session-history-search-params";

const sessions = [
  {
    id: "practice-1",
    isRound: false,
    sourceLabel: "Rapsodo",
    clubs: ["7i"],
    dateGroup: "Today",
  },
  {
    id: "round-1",
    isRound: true,
    sourceLabel: "Scorecard",
    clubs: ["Driver"],
    dateGroup: "This week",
  },
  {
    id: "practice-2",
    isRound: false,
    sourceLabel: "TrackMan",
    clubs: ["Driver"],
    dateGroup: "Earlier",
  },
] as const;

describe("session history presentation state", () => {
  it("treats the session query as focus without removing other matching sessions", () => {
    const { filters } = resolveSessionHistorySearchParams(
      "type=practice&session=practice-2",
      sessions,
    );

    const view = deriveSessionHistoryView(sessions, filters);

    expect(view.visible.map((session) => session.id)).toEqual(["practice-1", "practice-2"]);
    expect(view.focused?.id).toBe("practice-2");
  });

  it("falls back to the newest visible session when no explicit focus is present", () => {
    const { filters } = resolveSessionHistorySearchParams("type=practice", sessions);

    expect(deriveSessionHistoryView(sessions, filters).focused?.id).toBe("practice-1");
  });

  it("prunes hidden comparison sessions while preserving visible selection order", () => {
    expect(
      pruneSessionComparisonSelection(
        ["round-1", "practice-2", "practice-1"],
        ["practice-1", "practice-2"],
      ),
    ).toEqual(["practice-2", "practice-1"]);
  });

  it("retains the same selection reference when every comparison remains visible", () => {
    const selected = ["practice-1", "practice-2"];

    expect(pruneSessionComparisonSelection(selected, ["practice-2", "practice-1"])).toBe(selected);
  });

  it("does not revive a pruned comparison when Back broadens the visible history", () => {
    const afterNarrowing = pruneSessionComparisonSelection(
      ["round-1", "practice-1"],
      ["practice-1", "practice-2"],
    );
    const afterBack = pruneSessionComparisonSelection(afterNarrowing, [
      "practice-1",
      "round-1",
      "practice-2",
    ]);

    expect(afterNarrowing).toEqual(["practice-1"]);
    expect(afterBack).toEqual(["practice-1"]);
  });
});
