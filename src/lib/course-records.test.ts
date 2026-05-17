import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  evaluateVerification,
  isBoardEligibleStatus,
  rankRecordAttempts,
  summarizeRound,
} from "@/lib/course-records";

describe("course record verification", () => {
  it("awards gold verification only when direct Rapsodo proof and screenshot match", () => {
    expect(
      evaluateVerification({
        expectedScore: 74,
        extractedScorecardTotal: 74,
        hasRapsodoDirect: true,
        hasScorecardScreenshot: true,
        directRapsodoRequired: true,
        screenshotRequired: true,
      }),
    ).toMatchObject({
      status: "verified",
      tier: "gold",
      proofStatus: "verified",
    });
  });

  it("keeps required missing evidence out of verified boards", () => {
    const decision = evaluateVerification({
      expectedScore: 74,
      directRapsodoRequired: true,
      screenshotRequired: true,
    });

    expect(decision.status).toBe("pending_evidence");
    expect(decision.proofStatus).toBe("needs_review");
    expect(isBoardEligibleStatus(decision.status)).toBe(false);
  });

  it("marks scorecard mismatches for review", () => {
    const decision = evaluateVerification({
      expectedScore: 74,
      extractedScorecardTotal: 72,
      hasCsvHash: true,
      hasScorecardScreenshot: true,
    });

    expect(decision.status).toBe("mismatch");
    expect(decision.proofStatus).toBe("needs_review");
    expect(decision.reasons.join(" ")).toContain("does not match");
  });
});

describe("course record ranking", () => {
  it("keeps one best attempt per user and uses verification tier as the tiebreaker", () => {
    const base = new Date("2026-05-01T09:00:00.000Z");
    const ranked = rankRecordAttempts(
      [
        attempt("a1", "user-a", 75, "verified", "silver", base),
        attempt("a2", "user-a", 73, "verified", "silver", new Date("2026-05-02T09:00:00.000Z")),
        attempt("b1", "user-b", 73, "verified", "gold", new Date("2026-05-03T09:00:00.000Z")),
        attempt("c1", "user-c", 70, "rejected", "gold", new Date("2026-05-04T09:00:00.000Z")),
        attempt("d1", "user-d", 74, "manual_only", "bronze", new Date("2026-05-05T09:00:00.000Z")),
      ],
      "asc",
    );

    expect(ranked.map((row) => [row.userId, row.id, row.rank])).toEqual([
      ["user-b", "b1", 1],
      ["user-a", "a2", 2],
    ]);
  });

  it("keeps manual-only attempts out of verified champion boards", () => {
    const ranked = rankRecordAttempts(
      [
        attempt("manual", "user-a", 63, "manual_only", "manual", new Date("2026-05-01T09:00:00.000Z")),
        attempt("verified", "user-b", 74, "verified", "silver", new Date("2026-05-01T10:00:00.000Z")),
      ],
      "asc",
    );

    expect(ranked.map((row) => row.id)).toEqual(["verified"]);
  });

  it("supports descending launch-monitor records", () => {
    const ranked = rankRecordAttempts(
      [
        attempt("a1", "user-a", 288.2, "verified", "gold", new Date("2026-05-01T09:00:00.000Z")),
        attempt("b1", "user-b", 301.6, "verified", "silver", new Date("2026-05-01T10:00:00.000Z")),
      ],
      "desc",
    );

    expect(ranked[0]).toMatchObject({ userId: "user-b", rank: 1 });
  });
});

describe("course record round summaries", () => {
  it("normalises nine-hole scorecards into an eighteen-hole equivalent", () => {
    const summary = summarizeRound(
      {
        scorecardJson: [5, 4, 4, 4, 5, 4, 4, 4, 5].map((score, index) => ({
          holeNumber: index + 1,
          par: 4,
          yards: 360,
          name: null,
          score,
          netScore: score,
        })),
      } as never,
      { courseRating: 35, slopeRating: 113 } as never,
    );

    expect(summary).toMatchObject({
      totalScore: 78,
      totalNetScore: 78,
      stablefordPoints: 30,
      frontNineScore: 39,
      backNineScore: 39,
      holeCount: 18,
      originalHoleCount: 9,
      isNineHoleEquivalent: true,
    });
  });
});

function attempt(
  id: string,
  userId: string,
  metricValue: number,
  verificationStatus: string,
  verificationTier: string,
  submittedAt: Date,
) {
  return {
    id,
    userId,
    metricValue,
    verificationStatus,
    verificationTier,
    submittedAt,
  };
}
