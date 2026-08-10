import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { rankTournamentStandings, summarizeTournamentViewerEvidence } from "@/lib/tournaments";
import {
  isMajorTourEvent,
  normalizeTourPlayerName,
  parseEspnTourScores,
  pickTourCalendarEvents,
} from "@/lib/tour-event-sync";
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

describe("tournament viewer evidence", () => {
  it("summarizes only stored viewer submission proof", () => {
    expect(
      summarizeTournamentViewerEvidence(4, [
        {
          verificationStatus: "verified",
          rapsodoSyncSessionId: "sync-1",
          scorecardScreenshotPath: "proof/round-1.png",
        },
        {
          verificationStatus: "pending_evidence",
          rapsodoSyncSessionId: null,
          scorecardScreenshotPath: "proof/round-2.png",
        },
      ]),
    ).toEqual({
      submissionCount: 2,
      verifiedSubmissionCount: 1,
      rapsodoProofCount: 1,
      scorecardProofCount: 2,
      roundsDue: 2,
    });
  });
});

describe("tournament entry terms", () => {
  it("requires the current terms version and explicit acceptance", () => {
    expect(hasAcceptedTournamentEntryTerms("accepted", TOURNAMENT_ENTRY_TERMS_VERSION)).toBe(true);
    expect(hasAcceptedTournamentEntryTerms(null, TOURNAMENT_ENTRY_TERMS_VERSION)).toBe(false);
    expect(hasAcceptedTournamentEntryTerms("accepted", "old-version")).toBe(false);
  });
});

describe("tour event sync helpers", () => {
  it("uses a major as the monthly event and a different tour event as the weekly event", () => {
    const selections = pickTourCalendarEvents(
      [
        {
          id: "major",
          label: "PGA Championship",
          startDate: "2026-05-14T07:00Z",
          endDate: "2026-05-17T07:00Z",
        },
        {
          id: "weekly",
          label: "THE CJ CUP Byron Nelson",
          startDate: "2026-05-21T07:00Z",
          endDate: "2026-05-24T07:00Z",
        },
      ],
      new Date("2026-05-21T12:00:00.000Z"),
    );

    expect(
      selections.map((selection) => [selection.kind, selection.event.id, selection.scheduledKey]),
    ).toEqual([
      ["monthly", "major", "monthly-major-2026-05"],
      ["weekly", "weekly", "weekly-open-2026-05-18"],
    ]);
  });

  it("parses only completed ESPN round scores", () => {
    const scores = parseEspnTourScores({
      id: "event",
      competitions: [
        {
          competitors: [
            {
              id: "9484",
              order: 1,
              score: "-6",
              athlete: { displayName: "Ludvig Åberg" },
              linescores: [
                { period: 1, value: 67, displayValue: "-3" },
                { period: 2, value: 69, displayValue: "-1" },
                { period: 3, value: 0, displayValue: "-" },
              ],
            },
          ],
        },
      ],
    });

    expect(scores[0]).toMatchObject({
      externalAthleteId: "9484",
      playerName: "Ludvig Åberg",
      totalScore: "-6",
      roundScores: [
        { roundNumber: 1, grossScore: 67, displayScore: "-3" },
        { roundNumber: 2, grossScore: 69, displayScore: "-1" },
      ],
    });
    expect(normalizeTourPlayerName("Ludvig Åberg Jr.")).toBe("ludvig aberg");
    expect(isMajorTourEvent("U.S. Open")).toBe(true);
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
