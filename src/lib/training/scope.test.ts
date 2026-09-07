import { describe, expect, it } from "vitest";
import { parseTrainingScope } from "./ranges";
import { selectTrainingRangeData } from "./rangeSelection";
import type { TrainingOverTimeData } from "./trainingData";

describe("training history scope", () => {
  it.each([
    [{ from: "2026-02-30", to: "2026-03-01" }, "valid"],
    [{ from: "2026-03-02", to: "2026-03-01" }, "before"],
    [{ from: "2026-01-01", to: "2027-01-01" }, "future"],
    [{ from: "2026-01-01" }, "valid"],
    [{ activity: "foreign" }, "supported"],
  ])("rejects invalid URL scope %j", (query, message) => {
    expect(parseTrainingScope(query, "2026-09-07").error).toContain(message);
  });
  it("filters inclusive dates and sources without changing all-activity readiness", () => {
    const baseline = {
      rangeKey: "1y",
      today: "2026-09-07",
      summary: { fitness: { value: 42 } },
      latest: { fitness: 42 },
      series: [
        { date: "2026-09-01", load: 100, fitness: 42 },
        { date: "2026-09-02", load: 200, fitness: 43 },
        { date: "2026-09-03", load: 300, fitness: 44 },
      ],
      sessions: [
        {
          id: "one",
          sourceType: "round",
          sessionDate: "2026-09-01",
          sessionLoad: 50,
          title: "Nine holes",
        },
        {
          id: "two",
          sourceType: "manual",
          sessionDate: "2026-09-01",
          sessionLoad: 50,
          title: "Mobility",
        },
        {
          id: "three",
          sourceType: "round",
          sessionDate: "2026-09-02",
          sessionLoad: 200,
          title: "Eighteen holes",
        },
        {
          id: "four",
          sourceType: "round",
          sessionDate: "2026-09-03",
          sessionLoad: 300,
          title: "Later holes",
        },
      ],
      sessionMarkers: [{ date: "2026-09-01", totalLoad: 100, sessionCount: 2 }],
    } as unknown as TrainingOverTimeData;
    const scope = parseTrainingScope(
      { from: "2026-09-01", to: "2026-09-02", activity: "round", q: "holes" },
      baseline.today,
    ).scope;
    const result = selectTrainingRangeData(baseline, "3m", scope);
    expect(result.sessions.map((session) => session.id)).toEqual(["one", "three"]);
    expect(result.series.map((point) => point.load)).toEqual([50, 200]);
    expect(result.sessionMarkers[0]).toMatchObject({ totalLoad: 50, sessionCount: 1 });
    expect(result.summary).toBe(baseline.summary);
    expect(result.latest).toBe(baseline.latest);
    expect(baseline.series[0].load).toBe(100);
    expect(selectTrainingRangeData(baseline, "3m", { ...scope, q: "absent" }).sessions).toEqual([]);
  });
});
