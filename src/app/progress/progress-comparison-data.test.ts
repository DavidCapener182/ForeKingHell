import { describe, expect, it } from "vitest";
import {
  comparisonDirection,
  comparisonObservations,
  comparisonScope,
  weeklyControlChanges,
  type ComparisonClub,
} from "./progress-comparison-data";
import { progressTab, progressTabUrl } from "./progress-navigation";
import type { ClubAnalyticsShot } from "@/lib/club-analytics";

describe("Progress URL and measured evidence", () => {
  const clubs: ComparisonClub[] = [{ clubId: "accessible", name: "7 iron", observations: [] }];
  it("never substitutes a requested unavailable club or measure", () => {
    expect(
      comparisonScope(clubs, new URLSearchParams("compareClub=foreign&compareMeasure=carry"))
        .unavailableClub,
    ).toBe(true);
    expect(comparisonScope(clubs, new URLSearchParams("compareClub=foreign")).club).toBeUndefined();
    expect(
      comparisonScope(clubs, new URLSearchParams("compareMeasure=invalid")).measure,
    ).toBeNull();
    expect(comparisonScope(clubs, new URLSearchParams("compareMeasure=total")).measure).toBe(
      "total",
    );
  });
  it("validates calendar dates and reversed periods", () => {
    for (const query of [
      "compareFrom=2026-02-30",
      "compareFrom=bad",
      "compareFrom=2026-09-02&compareTo=2026-09-01",
    ])
      expect(comparisonScope(clubs, new URLSearchParams(query)).datesValid).toBe(false);
  });
  it("keeps the complete comparison and fragment while validating tabs", () => {
    expect(progressTab("unknown")).toBe("performance");
    expect(
      progressTabUrl(
        "https://fixture/progress?compareClub=foreign&compareMeasure=total&compareFrom=2026-01-01#evidence",
        "goals",
      ),
    ).toBe(
      "/progress?compareClub=foreign&compareMeasure=total&compareFrom=2026-01-01&tab=goals#evidence",
    );
  });
  it("describes equal rounded values as steady, including negative zero", () => {
    expect(comparisonDirection(100, 100, "carry")).toContain("steady");
    expect(comparisonDirection(100, 99.999, "total")).toContain("steady");
    expect(comparisonDirection(5, 3, "side")).toContain("less");
  });
  it("keeps measured total distinct and preserves session dates/counts", () => {
    const shots = Array.from(
      { length: 12 },
      (_, i) =>
        ({
          id: String(i),
          clubType: "7i",
          sessionId: i < 6 ? "before" : "after",
          shotAt: i < 6 ? "2026-08-01T12:00:00Z" : "2026-09-01T12:00:00Z",
          carryYd: 150,
          totalYd: i < 6 ? 165 : null,
          sideCarryYd: 3,
          qualityTag: null,
          shotCategory: null,
          sessionType: "range",
        }) as ClubAnalyticsShot,
    );
    const result = comparisonObservations(shots, "7i");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      sessionId: "before",
      carry: 150,
      total: 165,
      date: "2026-08-01T12:00:00.000Z",
    });
    expect(result[1]).toMatchObject({
      sessionId: "after",
      carry: 150,
      total: null,
      counts: { total: 0 },
    });
  });
  it("ranks weekly control using comparable measured windows, excluding sparse/future evidence", () => {
    const club = (id: string, before: number, after: number, count = 10): ComparisonClub => ({
      clubId: id,
      name: id,
      observations: [
        {
          sessionId: `${id}-before`,
          date: "2026-08-27T12:00:00.000Z",
          count,
          carry: 150,
          total: 160,
          side: before,
          counts: { carry: count, total: count, side: count },
        },
        {
          sessionId: `${id}-after`,
          date: "2026-09-04T12:00:00.000Z",
          count,
          carry: 150,
          total: 160,
          side: after,
          counts: { carry: count, total: count, side: count },
        },
        {
          sessionId: `${id}-future`,
          date: "2027-01-01T12:00:00.000Z",
          count: 50,
          carry: 150,
          total: 160,
          side: 100,
          counts: { carry: 50, total: 50, side: 50 },
        },
      ],
    });
    const result = weeklyControlChanges(
      [club("better", 6, 3), club("worse", 3, 5), club("sparse", 10, 1, 2), club("steady", 4, 4)],
      "2026-08-30T12:00:00.000Z",
      "2026-09-06T12:00:00.000Z",
    );
    expect(result.improvement?.club.clubId).toBe("better");
    expect(result.decline?.club.clubId).toBe("worse");
    expect(result.comparedClubs).toBe(3);
  });
});
