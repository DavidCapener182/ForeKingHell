import { describe, expect, it } from "vitest";
import {
  mobileSessionMetrics,
  sessionFocusClub,
  mobileSessionVerdict,
  sessionPracticeHref,
} from "./mobile-session-review";
const shot = (carryYd: number | null, sideCarryYd: number | null) => ({
  carryYd,
  sideCarryYd,
  ballSpeedMph: null,
  clubSpeedMph: null,
  launchAngleDeg: null,
  smashFactor: null,
});
describe("mobile session review", () => {
  it("shows carry even when side data is absent, without inventing other metrics", () => {
    expect(mobileSessionMetrics([shot(140, null), shot(150, null), shot(160, null)])).toEqual([
      { label: "carry", value: "150", unit: "yd", detail: "Median of 3 trusted carry readings" },
    ]);
  });
  it("uses independent sample counts and a measured central dispersion range", () => {
    const metrics = mobileSessionMetrics([
      shot(140, -10),
      shot(150, 0),
      { ...shot(160, 10), ballSpeedMph: 105, smashFactor: 1.4 },
      shot(null, null),
    ]);
    expect(metrics.find((m) => m.label === "dispersion width")).toMatchObject({
      value: "16",
      detail: "Middle 80% of 3 measured side readings",
    });
    expect(metrics.find((m) => m.label === "ball speed")).toMatchObject({ value: "105.0" });
    expect(metrics.find((m) => m.label === "smash factor")).toMatchObject({ value: "1.40" });
  });
  it("omits insufficient dispersion and nonfinite measurements", () => {
    expect(mobileSessionMetrics([{ ...shot(NaN, 0), clubSpeedMph: Infinity }])).toEqual([]);
  });
  it("keeps the selected review focus in the next practice link", () => {
    const url = new URL(sessionPracticeHref("7i", "7 Iron"), "https://example.test");
    expect(url.pathname).toBe("/practice/quick-range");
    expect(url.searchParams.get("club")).toBe("7i");
    expect(url.searchParams.get("focus")).toBe("7 Iron control");
    expect(sessionPracticeHref(null, null)).toBe("/practice");
  });
  it("makes improvement claims only from supported club verdicts", () => {
    expect(
      mobileSessionVerdict([
        { clubLabel: "Driver", verdict: "better", score: 3 },
        { clubLabel: "7 Iron", verdict: "worse", score: -2 },
      ]),
    ).toBe("Driver improved, while 7 Iron fell behind its previous baseline.");
    expect(mobileSessionVerdict([{ clubLabel: "Driver", verdict: "new", score: 0 }])).toBe(
      "More comparable shots are needed to judge a change.",
    );
    expect(mobileSessionVerdict([])).toBe("More comparable shots are needed to judge a change.");
  });
  it("uses a measured club when a linked plan names an absent or untrusted club", () => {
    expect(sessionFocusClub("driver", "7i", ["7i", "5w"], ["driver", "7i", "5w"])).toBe("7i");
    expect(sessionFocusClub("driver", "7i", ["driver", "7i"], ["driver", "7i"])).toBe("driver");
    expect(sessionFocusClub("driver", null, [], ["5w"])).toBe("5w");
    expect(sessionFocusClub(null, null, [], [])).toBeNull();
  });
});
