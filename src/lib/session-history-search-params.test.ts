import { describe, expect, it } from "vitest";

import {
  buildSessionHistoryQuery,
  clearSessionHistoryQuery,
  resolveSessionHistorySearchParams,
  sessionMatchesHistoryFilters,
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

describe("history search", () => {
  it("keeps source/title matching and unrelated URL context", () => {
    const rows = [
      { ...sessions[0], title: "Long Driver session" },
      { ...sessions[1], title: "Evening round" },
    ];
    const query = buildSessionHistoryQuery(
      "campaign=summer&session=practice-1",
      { search: "long driver" },
      rows,
    );
    expect(query).toContain("campaign=summer");
    expect(query).not.toContain("session=");
    const { filters } = resolveSessionHistorySearchParams(query, rows);
    expect(
      rows.filter((row) => sessionMatchesHistoryFilters(row, filters)).map((row) => row.id),
    ).toEqual(["practice-1"]);
    expect(clearSessionHistoryQuery(query)).toBe("campaign=summer");
  });
  it("shows no results for unmatched text without resetting the search", () => {
    const { filters, changed } = resolveSessionHistorySearchParams("q=missing", sessions);
    expect(changed).toBe(false);
    expect(sessions.filter((row) => sessionMatchesHistoryFilters(row, filters))).toEqual([]);
  });
});

describe("server history catalog", () => {
  const options = { sources: ["Rapsodo", "Manual"], clubs: ["7i", "driver"], serverFiltered: true };
  it("retains valid catalog filters when the current result page is empty", () => {
    const resolved = resolveSessionHistorySearchParams(
      "q=missing&source=Manual&club=driver",
      [],
      options,
    );
    expect(resolved.changed).toBe(false);
    expect(resolved.filters.source).toBe("Manual");
    expect(resolved.filters.club).toBe("driver");
  });
  it("resets pagination when criteria change but preserves unrelated URL state", () => {
    expect(
      buildSessionHistoryQuery(
        "historyPage=3&historyLimit=900&campaign=summer",
        { source: "Manual" },
        [],
        options,
      ),
    ).toBe("campaign=summer&source=Manual");
    expect(clearSessionHistoryQuery("historyPage=3&historyLimit=900&q=old&campaign=summer")).toBe(
      "campaign=summer",
    );
  });
});
