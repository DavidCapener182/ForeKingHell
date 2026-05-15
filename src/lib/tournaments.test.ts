import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { rankTournamentStandings } from "@/lib/tournaments";
import {
  TOURNAMENT_ENTRY_TERMS_VERSION,
  hasAcceptedTournamentEntryTerms,
} from "@/lib/tournament-entry-terms";

describe("tournament standings", () => {
  it("prioritizes completed rounds before total score", () => {
    const ranked = rankTournamentStandings([
      row("entry-a", "user-a", 140, 136, 2, "2026-05-03T09:00:00.000Z"),
      row("entry-b", "user-b", 68, 66, 1, "2026-05-02T09:00:00.000Z"),
      row("entry-c", "user-c", 142, 134, 2, "2026-05-01T09:00:00.000Z"),
    ]);

    expect(ranked.map((standing) => [standing.userId, standing.rank])).toEqual([
      ["user-a", 1],
      ["user-c", 2],
      ["user-b", 3],
    ]);
  });

  it("uses net total and earliest submission as tiebreakers", () => {
    const ranked = rankTournamentStandings([
      row("entry-a", "user-a", 144, 140, 2, "2026-05-03T09:00:00.000Z"),
      row("entry-b", "user-b", 144, 138, 2, "2026-05-04T09:00:00.000Z"),
      row("entry-c", "user-c", 144, 138, 2, "2026-05-02T09:00:00.000Z"),
    ]);

    expect(ranked.map((standing) => [standing.userId, standing.rank])).toEqual([
      ["user-c", 1],
      ["user-b", 2],
      ["user-a", 3],
    ]);
  });
});

describe("tournament entry terms", () => {
  it("requires the current terms version and explicit acceptance", () => {
    expect(hasAcceptedTournamentEntryTerms("accepted", TOURNAMENT_ENTRY_TERMS_VERSION)).toBe(true);
    expect(hasAcceptedTournamentEntryTerms(null, TOURNAMENT_ENTRY_TERMS_VERSION)).toBe(false);
    expect(hasAcceptedTournamentEntryTerms("accepted", "old-version")).toBe(false);
  });
});

function row(
  entryId: string,
  userId: string,
  grossTotal: number,
  netTotal: number | null,
  roundsCompleted: number,
  latestSubmissionAt: string,
) {
  return {
    entryId,
    userId,
    grossTotal,
    netTotal,
    roundsCompleted,
    latestSubmissionAt: new Date(latestSubmissionAt),
  };
}
