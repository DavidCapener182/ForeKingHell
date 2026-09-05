import { describe, expect, it } from "vitest";
import {
  comparableScoringRounds,
  roundHistoryScore,
  roundHistoryVerdict,
} from "./round-history-evidence";

const holes = (count = 9, score: number | null = 4) =>
  Array.from({ length: count }, (_, i) => ({ holeNumber: i + 1, par: 4, score }));
const round = (id: string, type = "real_round", count = 9, roundStatus = "complete") => ({
  id,
  type,
  roundStatus,
  scorecardHoles: holes(count),
});

describe("round history evidence", () => {
  it("keeps a partial score visible against only scored-hole par", () => {
    const partial = holes();
    partial[1].score = null;
    expect(roundHistoryScore(partial, "complete")).toMatchObject({
      totalScore: 32,
      totalPar: 36,
      toPar: 0,
      complete: false,
      scoredHoles: 8,
    });
    expect(roundHistoryScore(holes(), "in_progress").complete).toBe(false);
    expect(roundHistoryScore([], "complete").complete).toBe(false);
  });
  it("rejects invalid scores as incomplete evidence", () => {
    const invalid = holes();
    invalid[0].score = NaN;
    expect(roundHistoryScore(invalid, "complete").complete).toBe(false);
    invalid[0].score = 0;
    expect(roundHistoryScore(invalid, "complete").complete).toBe(false);
  });
  it("compares only completed rounds with the same context and hole count", () => {
    const rounds = [
      round("active", "real_round", 9, "in_progress"),
      round("latest"),
      round("sim", "simulator"),
      round("long", "real_round", 18),
      round("older"),
    ];
    expect(comparableScoringRounds(rounds, "course", 9).map((r) => r.id)).toEqual([
      "older",
      "latest",
    ]);
    expect(rounds[0].id).toBe("active");
  });
  it("uses the latest eight eligible results in chronological order", () => {
    expect(
      comparableScoringRounds(
        Array.from({ length: 12 }, (_, i) => round(String(i))),
        "course",
        9,
      ).map((r) => r.id),
    ).toEqual(["7", "6", "5", "4", "3", "2", "1", "0"]);
  });
  it("describes saved scoring evidence without inventing pressure or causation", () => {
    expect(roundHistoryVerdict(holes(), "complete")).toBe("Finished at level par");
    expect(roundHistoryVerdict(holes(), "in_progress")).toBe("Continue round");
    expect(roundHistoryVerdict(holes(9, null), "complete")).toBe("Complete the scorecard");
    const scored = holes();
    scored[3].score = 7;
    expect(roundHistoryVerdict(scored, "complete")).toBe("Hole 4 · 3 over par");
    expect(
      roundHistoryVerdict(
        scored.map((h, i) => ({ ...h, penalties: i === 0 ? 2 : 0 })),
        "complete",
      ),
    ).toBe("2 penalty strokes recorded");
  });
});
