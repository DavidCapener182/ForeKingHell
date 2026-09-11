import { describe, expect, it } from "vitest";
import { calculateRoundLoad, roundLoadExplanation, ROUND_LOAD_MODEL } from "./roundLoad";

describe("real round workload", () => {
  it("uses the reported duration and effort for the trolley round", () => {
    expect(calculateRoundLoad(18, 213, 7)).toEqual({
      minutes: 213,
      load: 1491,
      durationEstimated: false,
    });
  });
  it("scales missing duration by holes without inventing recorded minutes", () => {
    expect(calculateRoundLoad(9, null, 3)).toEqual({
      minutes: 120,
      load: 360,
      durationEstimated: true,
    });
    expect(calculateRoundLoad(18, null, 3).load).toBe(720);
  });
  it.each([
    [18, 0, 7],
    [18, 213, 0],
    [18, 213, 11],
    [18, 1.5, 3],
    [0, 213, 3],
    [19, 213, 3],
  ])("rejects invalid inputs %j", (holes, minutes, rpe) =>
    expect(() => calculateRoundLoad(holes, minutes, rpe)).toThrow(),
  );
  it("labels estimated effort separately from a recorded duration", () => {
    expect(
      roundLoadExplanation({
        holesPlayed: 18,
        durationMinutes: 213,
        rpe: 3,
        loadMetadataJson: { model: ROUND_LOAD_MODEL, rpeEstimated: true },
      }),
    ).toBe("Estimated: 213 min × effort 3 (estimated).");
    expect(
      roundLoadExplanation({
        holesPlayed: 18,
        durationMinutes: 213,
        rpe: 7,
        loadMetadataJson: { model: ROUND_LOAD_MODEL, rpeEstimated: false, movement: "trolley" },
      }),
    ).toBe("Recorded effort: 213 min × effort 7.");
  });
});
