import { describe, expect, it } from "vitest";
import { contextRoundStatus, relinkRoundScorecard, roundCompletionIssue } from "./round-context";

const hole = {
  holeNumber: 1,
  par: 4,
  yards: 350,
  strokeIndex: 9,
  name: "Opening hole",
  score: 5,
  putts: 1,
  puttsSource: "manual" as const,
  notes: "Keep this",
  fairwayHit: true,
};

describe("round completion", () => {
  it("requires actual valid scores without requiring a full eighteen-hole round", () => {
    expect(roundCompletionIssue([hole])).toBeNull();
    expect(roundCompletionIssue([])).toContain("Add the scorecard");
    for (const score of [null, 0, -1, 2.5, Infinity]) {
      expect(roundCompletionIssue([{ ...hole, score }])).toContain("1 remaining hole");
    }
  });
  it("rejects duplicate or invalid hole identities", () => {
    expect(roundCompletionIssue([hole, hole])).toContain("hole numbers");
    expect(roundCompletionIssue([{ ...hole, holeNumber: 19 }])).toContain("hole numbers");
  });
  it("accepts only explicit supported context statuses", () => {
    expect(contextRoundStatus("complete")).toBe("complete");
    expect(contextRoundStatus("in_progress")).toBe("in_progress");
    for (const status of [null, "", "other"]) expect(() => contextRoundStatus(status)).toThrow();
  });
});

describe("course relinking", () => {
  it("keeps recorded holes and evidence while replacing canonical tee facts", () => {
    const teeWithExtraFields = { ...hole, score: 99, par: 3, yards: 180, strokeIndex: 15 };
    const linked = relinkRoundScorecard(
      [hole],
      [teeWithExtraFields, { holeNumber: 2, par: 5, yards: 490, strokeIndex: 1 }],
    );
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({
      score: 5,
      putts: 1,
      puttsSource: "manual",
      notes: "Keep this",
      par: 3,
      yards: 180,
      strokeIndex: 15,
      fairwayHit: null,
    });
  });
  it("rejects missing tee data and never drops a recorded hole", () => {
    expect(() => relinkRoundScorecard([hole], [])).toThrow("saved hole-by-hole");
    expect(() => relinkRoundScorecard([hole], [{ ...hole, holeNumber: 2 }])).toThrow(
      "missing holes",
    );
  });
  it("uses actual tee holes for an unlinked empty scorecard", () => {
    expect(relinkRoundScorecard([], [hole])).toEqual([
      { holeNumber: 1, par: 4, yards: 350, strokeIndex: 9, name: null },
    ]);
  });
});
