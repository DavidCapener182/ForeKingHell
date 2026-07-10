import { afterEach, describe, expect, it, vi } from "vitest";

import { createScorecardProofToken, verifyScorecardProofToken } from "@/lib/scorecard-proof-token";

const input = {
  userId: "00000000-0000-4000-8000-000000000001",
  scopeType: "course_record" as const,
  scopeId: "00000000-0000-4000-8000-000000000002",
  roundNumber: null,
  imageHash: "a".repeat(64),
  totalScore: 72,
  courseName: "Test Links",
  teeName: "White",
  dateIso: "2026-07-10",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("scorecard proof tokens", () => {
  it("accepts the intended scope and rejects another protected object", () => {
    vi.stubEnv("SCORECARD_PROOF_SECRET", "test-proof-secret-with-more-than-32-bytes");
    const token = createScorecardProofToken(input);

    expect(
      verifyScorecardProofToken(token, input.userId, {
        scopeType: "course_record",
        scopeId: input.scopeId,
      }),
    ).toMatchObject({
      userId: input.userId,
      scopeType: "course_record",
      scopeId: input.scopeId,
      imageHash: input.imageHash,
      totalScore: 72,
    });
    expect(
      verifyScorecardProofToken(token, input.userId, {
        scopeType: "course_record",
        scopeId: "00000000-0000-4000-8000-000000000003",
      }),
    ).toBeNull();
  });

  it("rejects another user, another scope type, and token tampering", () => {
    vi.stubEnv("SCORECARD_PROOF_SECRET", "test-proof-secret-with-more-than-32-bytes");
    const token = createScorecardProofToken(input);

    expect(
      verifyScorecardProofToken(token, "00000000-0000-4000-8000-000000000004", {
        scopeType: "course_record",
        scopeId: input.scopeId,
      }),
    ).toBeNull();
    expect(
      verifyScorecardProofToken(token, input.userId, {
        scopeType: "tournament",
        scopeId: input.scopeId,
      }),
    ).toBeNull();
    expect(
      verifyScorecardProofToken(`${token.slice(0, -1)}x`, input.userId, {
        scopeType: "course_record",
        scopeId: input.scopeId,
      }),
    ).toBeNull();
  });

  it("fails closed outside local development when no signing secret exists", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCORECARD_PROOF_SECRET", "");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");

    expect(() => createScorecardProofToken(input)).toThrow("SCORECARD_PROOF_SECRET is required");
  });
});
