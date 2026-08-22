import { describe, expect, it } from "vitest";

import {
  buildShotMasterDetailDto,
  type ShotMasterDetailSource,
} from "@/lib/shot-master-detail-dto";

function shot(overrides: Partial<ShotMasterDetailSource> = {}): ShotMasterDetailSource {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sessionId: "00000000-0000-4000-8000-000000000002",
    sessionSource: "rapsodo_cloud",
    sessionType: "practice",
    sessionPlayContext: "practice_bay",
    sessionCourseId: null,
    providerKind: null,
    providerSessionMode: null,
    fileName: "today.csv",
    shotAt: new Date("2026-08-22T10:00:00.000Z"),
    shotNumber: 24,
    courseHoleNumber: null,
    courseHoleShotNumber: null,
    clubType: "driver",
    clubBrand: "TaylorMade",
    clubModel: "Qi4D Max",
    carryYd: 194.7,
    totalYd: 200.2,
    ballSpeedMph: 127.6,
    clubSpeedMph: 86.1,
    launchAngleDeg: 16.9,
    launchDirectionDeg: 2.2,
    apexFt: 66,
    sideCarryYd: 39.4,
    attackAngleDeg: null,
    clubPathDeg: 6.4,
    faceAngleDeg: null,
    descentAngleDeg: 41.1,
    smashFactor: 1.48,
    spinRate: null,
    spinAxis: null,
    shotShape: null,
    shotCategory: "full",
    qualityTag: null,
    reviewStatus: "included",
    reviewReason: null,
    reviewConfidence: null,
    reviewSource: null,
    reviewedAt: null,
    clubDataEstType: "0",
    sourceRawJson: { "Carry Distance": "194.7", "Ball Speed": "127.6" },
    reviewEvents: [],
    ...overrides,
  };
}

describe("shot master-detail DTO", () => {
  it("keeps a practice shot permanently deletable and exposes only formatted detail fields", () => {
    const result = buildShotMasterDetailDto(shot());

    expect(result.clubLabel).toBe("TaylorMade Qi4D Max");
    expect(result.carryLabel).toBe("194.7");
    expect(result.canDeletePermanently).toBe(true);
    expect(result.evidenceStatus).toBe("trusted");
    expect(result.sourceEntries).toEqual([
      { key: "Ball Speed", value: "127.6" },
      { key: "Carry Distance", value: "194.7" },
    ]);
  });

  it.each([
    { sessionType: "course" },
    { sessionType: "real_round" },
    { sessionPlayContext: "simulated_course" },
    { sessionCourseId: "00000000-0000-4000-8000-000000000003" },
    { courseHoleNumber: 7 },
  ])("blocks permanent deletion for course-managed evidence %#", (boundary) => {
    expect(buildShotMasterDetailDto(shot(boundary)).canDeletePermanently).toBe(false);
  });

  it.each(["range", "target", "ctp"])(
    "keeps a non-course simulator %s session permanently deletable",
    (providerSessionMode) => {
      expect(
        buildShotMasterDetailDto(
          shot({
            sessionType: "simulator",
            sessionPlayContext: "simulator",
            providerKind: "simulation",
            providerSessionMode,
          }),
        ).canDeletePermanently,
      ).toBe(true);
    },
  );

  it("protects simulator sessions whose provider mode is missing or course-like", () => {
    expect(
      buildShotMasterDetailDto(
        shot({
          sessionType: "simulator",
          sessionPlayContext: "simulator",
        }),
      ).canDeletePermanently,
    ).toBe(false);
    expect(
      buildShotMasterDetailDto(
        shot({
          sessionType: "simulator",
          sessionPlayContext: "simulator",
          providerKind: "simulation",
          providerSessionMode: "courses",
        }),
      ).canDeletePermanently,
    ).toBe(false);
  });

  it("preserves review detail for the selected-shot history tab", () => {
    const result = buildShotMasterDetailDto(
      shot({
        qualityTag: "excluded",
        reviewStatus: "user_excluded",
        reviewReason: "Player confirmed a mishit.",
        reviewConfidence: 1,
        reviewSource: "user",
        reviewedAt: new Date("2026-08-22T11:00:00.000Z"),
        reviewEvents: [
          {
            id: "00000000-0000-4000-8000-000000000004",
            previousStatus: "included",
            status: "user_excluded",
            reason: "Player confirmed a mishit.",
            confidence: 1,
            source: "user",
            previousQualityTag: null,
            resultingQualityTag: "excluded",
            createdAt: new Date("2026-08-22T11:00:00.000Z"),
          },
        ],
      }),
    );

    expect(result.reviewStatusLabel).toBe("User excluded");
    expect(result.reviewReason).toBe("Player confirmed a mishit.");
    expect(result.reviewEvents).toHaveLength(1);
    expect(result.evidenceStatus).toBe("untrusted");
  });
});
