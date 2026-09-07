import { describe, expect, it } from "vitest";
import { buildTodayHighlights } from "./today-highlights";
import type { TodayPracticeData, TodayPracticeShot } from "./today-session-data";

function shot(overrides: Partial<TodayPracticeShot>): TodayPracticeShot {
  return {
    id: "shot-a",
    sessionId: "session-a",
    clubType: "7i",
    shotNumber: 1,
    carryYd: 140,
    sideCarryYd: 2,
    dataConfidence: { alignment: "aligned" },
    ...overrides,
  } as TodayPracticeShot;
}
function data(shots: TodayPracticeShot[]): TodayPracticeData {
  return {
    dateLabel: "6 September 2026",
    sessions: [{ id: "session-a" }],
    shots,
    clubComparisons: [],
    comparisonShots: [],
    previousComparisonShots: [],
  } as unknown as TodayPracticeData;
}

describe("session highlights", () => {
  it("never presents non-finite measurements as a longest or straightest shot", () => {
    const highlights = buildTodayHighlights(
      data([
        shot({ id: "invalid", carryYd: Infinity, sideCarryYd: NaN }),
        shot({ id: "valid", carryYd: 150, sideCarryYd: 2 }),
      ]),
    );
    expect(highlights.find((item) => item.id === "longest")?.href).toContain("shotId=valid");
    expect(highlights.find((item) => item.id === "control")?.href).toContain("shotId=valid");
  });
  it("keeps the longest and straightest shot evidence independent and scoped to the review", () => {
    const highlights = buildTodayHighlights(
      data([
        shot({ id: "long", carryYd: 260, sideCarryYd: 30, clubType: "driver" }),
        shot({ id: "straight", carryYd: 130, sideCarryYd: -0.5 }),
      ]),
    );
    expect(highlights.find((item) => item.id === "longest")).toMatchObject({
      value: "260 yd",
      href: "/shots?sessionId=session-a&shotId=long",
      evidence: "6 September 2026 · 1 session · shot 1",
    });
    expect(highlights.find((item) => item.id === "control")).toMatchObject({
      value: "0.5 yd offline",
      href: "/shots?sessionId=session-a&shotId=straight",
    });
    expect(highlights.some((item) => item.id === "change")).toBe(false);
  });
  it("omits questioned direction while retaining an independently eligible carry", () => {
    const highlights = buildTodayHighlights(
      data([shot({ carryYd: 270, sideCarryYd: 0, dataConfidence: { alignment: "misaligned" } })]),
    );
    expect(highlights.map((item) => item.id)).toEqual(["longest"]);
  });
  it("does not invent highlights for empty or missing measurements", () => {
    expect(buildTodayHighlights(null)).toEqual([]);
    expect(buildTodayHighlights(data([]))).toEqual([]);
    expect(buildTodayHighlights(data([shot({ carryYd: null, sideCarryYd: null })]))).toEqual([]);
  });
});
