import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ getDb: vi.fn() }));

import { getDb } from "@/db/client";
import { getTodayShotDetailRows } from "@/lib/today-shot-detail-data";

const userId = "00000000-0000-4000-8000-000000009999";
const sessionId = "00000000-0000-4000-8000-000000008888";

function shotId(index: number) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function shotRow(id: string, index: number) {
  return {
    id,
    sessionId,
    sessionSource: "rapsodo_cloud",
    sessionType: "simulator",
    sessionPlayContext: "simulator",
    sessionCourseId: null,
    fileName: "large-target-session.csv",
    shotAt: new Date("2026-08-22T10:00:00.000Z"),
    shotNumber: index + 1,
    courseHoleNumber: null,
    courseHoleShotNumber: null,
    clubType: "7i",
    clubBrand: "TaylorMade",
    clubModel: "Qi",
    carryYd: 145,
    totalYd: 150,
    ballSpeedMph: 101,
    clubSpeedMph: 78,
    launchAngleDeg: 18,
    launchDirectionDeg: 1,
    apexFt: 72,
    sideCarryYd: 4,
    attackAngleDeg: -3,
    clubPathDeg: 2,
    faceAngleDeg: 1,
    descentAngleDeg: 43,
    smashFactor: 1.29,
    spinRate: 5_200,
    spinAxis: 2,
    shotShape: "straight",
    shotCategory: "full",
    qualityTag: null,
    reviewStatus: "included" as const,
    reviewReason: null,
    reviewConfidence: null,
    reviewSource: null,
    reviewedAt: null,
    clubDataEstType: null,
    sourceRawJson: { "Carry Distance": "145" },
  };
}

function queryReturning<T>(result: T) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe("Today shot detail loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps exact DTO actions available for plotted shots after the first 250", async () => {
    const shotIds = Array.from({ length: 251 }, (_, index) => shotId(index + 1));
    const rows = shotIds.map(shotRow);
    let shotBatchIndex = 0;
    const select = vi.fn((selection: Record<string, unknown>) => {
      if ("sessionSource" in selection) {
        const batch = rows.slice(shotBatchIndex * 250, (shotBatchIndex + 1) * 250);
        shotBatchIndex += 1;
        return queryReturning(batch);
      }
      if ("previousStatus" in selection) {
        return queryReturning([]);
      }
      if ("providerSessionMode" in selection) {
        return queryReturning([
          {
            sessionId,
            providerKind: "simulation",
            providerSessionMode: "target",
          },
        ]);
      }
      throw new Error("Unexpected Today detail query");
    });
    vi.mocked(getDb).mockReturnValue({ select } as never);

    const details = await getTodayShotDetailRows({ userId, shotIds });

    expect(shotBatchIndex).toBe(2);
    expect(details).toHaveLength(251);
    expect(details.at(-1)).toMatchObject({
      id: shotIds[250],
      canDeletePermanently: true,
    });
  });
});
