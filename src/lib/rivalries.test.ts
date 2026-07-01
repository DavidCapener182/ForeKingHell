import { describe, expect, it } from "vitest";

import {
  buildRivalryPairings,
  buildRivalryStandings,
  formatToPar,
  weekPeriodKey,
} from "@/lib/rivalries";

describe("rivalries", () => {
  it("builds weekly standings from scored rounds", () => {
    const standings = buildRivalryStandings({
      members: [
        { userId: "a", displayName: "Ada" },
        { userId: "b", displayName: "Ben" },
      ],
      rounds: [
        {
          userId: "a",
          date: new Date("2026-06-30T12:00:00Z"),
          scorecardJson: [
            { score: 4, par: 4 },
            { score: 3, par: 4 },
          ],
        },
        {
          userId: "b",
          date: new Date("2026-06-30T12:00:00Z"),
          scorecardJson: [
            { score: 5, par: 4 },
            { score: 4, par: 4 },
          ],
        },
      ],
    });

    expect(standings[0]).toMatchObject({
      userId: "a",
      bestScore: 7,
      bestToPar: -1,
      roundsPlayed: 1,
    });
    expect(standings[0].points).toBeGreaterThan(standings[1].points);
  });

  it("pairs adjacent standings and awards by points", () => {
    const pairings = buildRivalryPairings([
      {
        userId: "a",
        displayName: "Ada",
        username: null,
        roundsPlayed: 1,
        bestScore: 72,
        bestToPar: 0,
        points: 24,
        lastPlayedAt: null,
        summary: "Best 72 (E)",
      },
      {
        userId: "b",
        displayName: "Ben",
        username: null,
        roundsPlayed: 1,
        bestScore: 75,
        bestToPar: 3,
        points: 19,
        lastPlayedAt: null,
        summary: "Best 75 (+3)",
      },
    ]);

    expect(pairings[0]).toMatchObject({
      userAId: "a",
      userBId: "b",
      winnerUserId: "a",
      summary: "Ada 24 - 19 Ben",
    });
  });

  it("formats period and to-par labels", () => {
    expect(weekPeriodKey(new Date("2026-07-01T10:00:00Z"))).toBe("2026-W27");
    expect(formatToPar(0)).toBe("E");
    expect(formatToPar(3)).toBe("+3");
    expect(formatToPar(-2)).toBe("-2");
  });
});
