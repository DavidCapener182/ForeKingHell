import { describe, expect, it } from "vitest";
import { calculateRoundHandicapEffect } from "./round-handicap-effect";

const round = (id: string, handicapDifferential: number | null, type = "real_round") => ({
  id,
  type,
  handicapDifferential,
});

describe("round handicap effect", () => {
  it("uses the estimate at the selected round and excludes later scores and simulator evidence", () => {
    const rounds = [
      round("future", 1),
      round("selected", 8),
      round("sim", 0, "simulator"),
      round("older", 10),
      round("oldest", 12),
    ];
    expect(calculateRoundHandicapEffect(rounds, "selected")).toMatchObject({
      scope: "Course",
      current: 6,
      previous: 9,
      delta: -3,
      direction: "down",
      sampleSize: 3,
    });
    expect(rounds.map((item) => item.id)).toEqual(["future", "selected", "sim", "older", "oldest"]);
  });

  it("keeps simulator estimates separate and distinguishes establishing from improving", () => {
    expect(
      calculateRoundHandicapEffect([round("sim", 7, "simulator"), round("real", 15)], "sim"),
    ).toMatchObject({
      scope: "Simulator",
      current: 7,
      previous: null,
      delta: null,
      direction: "none",
    });
  });

  it("does not attribute an older score's effect to missing or incomplete evidence", () => {
    const rounds = [round("incomplete", null), round("complete", 10)];
    expect(calculateRoundHandicapEffect(rounds, "incomplete")).toBeNull();
    expect(calculateRoundHandicapEffect(rounds, "missing")).toBeNull();
    expect(calculateRoundHandicapEffect([round("invalid", NaN)], "invalid")).toBeNull();
  });

  it("accounts for a score dropping out of the existing latest-20 calculation", () => {
    const rounds = [
      round("new", 20),
      ...Array.from({ length: 19 }, (_, index) => round(String(index), 10)),
      round("dropped", 0),
    ];
    expect(calculateRoundHandicapEffect(rounds, "new")).toMatchObject({
      current: 10,
      previous: 8.75,
      delta: 1.25,
      direction: "up",
    });
  });

  it("reports no change when a new score does not alter the estimate", () => {
    const rounds = Array.from({ length: 21 }, (_, index) => round(String(index), 10));
    expect(calculateRoundHandicapEffect(rounds, "0")).toMatchObject({
      current: 10,
      previous: 10,
      delta: 0,
      direction: "flat",
    });
  });
});
