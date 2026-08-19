import { describe, expect, it } from "vitest";

import {
  buildSessionHistoryQuery,
  clearSessionHistoryQuery,
  resolveSessionHistorySearchParams,
} from "@/lib/session-history-search-params";

const sessions = [
  {
    id: "practice-1",
    isRound: false,
    sourceLabel: "Rapsodo",
    clubs: ["7i", "PW"],
    dateGroup: "Today",
  },
  {
    id: "round-1",
    isRound: true,
    sourceLabel: "Scorecard",
    clubs: ["Driver", "7i"],
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

describe("session history search params", () => {
  it("parses a valid bookmark and preserves unrelated query state", () => {
    const resolved = resolveSessionHistorySearchParams(
      {
        type: "round",
        source: "Scorecard",
        club: "7i",
        date: "week",
        session: "round-1",
        campaign: "summer",
      },
      sessions,
    );

    expect(resolved.changed).toBe(false);
    expect(resolved.filters).toEqual({
      type: "round",
      source: "Scorecard",
      club: "7i",
      date: "week",
      sessionId: "round-1",
    });
    expect(new URLSearchParams(resolved.query).get("campaign")).toBe("summer");
  });

  it("removes invalid and duplicate owned values without deleting unrelated params", () => {
    const resolved = resolveSessionHistorySearchParams(
      {
        type: "invalid",
        source: "Unknown monitor",
        club: ["7i", "Driver"],
        date: "tomorrow",
        session: "missing-session",
        campaign: "summer",
      },
      sessions,
    );

    expect(resolved.changed).toBe(true);
    expect(resolved.filters).toEqual({
      type: "all",
      source: "all",
      club: "all",
      date: "all",
      sessionId: null,
    });
    expect(resolved.query).toBe("campaign=summer");
  });

  it("canonicalises the legacy rounds alias and rejects a selected session outside the filters", () => {
    const legacy = resolveSessionHistorySearchParams("type=rounds", sessions);
    const incompatible = resolveSessionHistorySearchParams(
      "type=practice&session=round-1",
      sessions,
    );

    expect(legacy.changed).toBe(true);
    expect(legacy.filters.type).toBe("round");
    expect(legacy.query).toBe("type=round");
    expect(incompatible.filters.sessionId).toBeNull();
    expect(incompatible.query).toBe("type=practice");
  });

  it("builds history entries that round-trip and clears stale session focus after filtering", () => {
    const query = buildSessionHistoryQuery(
      "type=practice&session=practice-1&campaign=summer",
      { source: "Rapsodo", club: "7i", date: "today" },
      sessions,
    );
    const resolved = resolveSessionHistorySearchParams(query, sessions);

    expect(resolved.filters).toEqual({
      type: "practice",
      source: "Rapsodo",
      club: "7i",
      date: "today",
      sessionId: null,
    });
    expect(new URLSearchParams(query).get("campaign")).toBe("summer");
    expect(new URLSearchParams(query).has("session")).toBe(false);
  });

  it("clears only session-owned state", () => {
    const query = clearSessionHistoryQuery(
      "type=round&source=Scorecard&club=7i&date=week&session=round-1&campaign=summer",
    );

    expect(query).toBe("campaign=summer");
  });
});
