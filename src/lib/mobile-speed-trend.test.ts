import { describe, it, expect } from "vitest";
import { selectMobileSpeedTrend } from "./mobile-speed-trend";
import type { SpeedCentreSession } from "./speed-training-data";
const now = Date.parse("2026-09-05T12:00:00Z");
const session = (id: string, patch: Partial<SpeedCentreSession> = {}): SpeedCentreSession => ({
  id,
  source: "manual",
  sessionDateIso: "2026-09-04T12:00:00Z",
  title: null,
  clubId: "driver",
  implementKind: "club",
  implementLabel: "Driver",
  speedSystem: null,
  handedness: "right",
  swingCount: 10,
  minSpeedMph: 90,
  avgSpeedMph: 95,
  maxSpeedMph: 100,
  targetSpeedMph: 105,
  notes: null,
  ...patch,
});
describe("phone seven-day speed trend", () => {
  it("selects the measured window and preserves session averages", () => {
    const result = selectMobileSpeedTrend(
      [
        session("old", { sessionDateIso: "2026-08-01T12:00:00Z" }),
        session("future", { sessionDateIso: "2026-09-06T12:00:00Z" }),
        session("now"),
        session("missing", { avgSpeedMph: null }),
      ],
      now,
    );
    expect(result.points.map((p) => p.id)).toEqual(["now"]);
    expect(result.points[0].value).toBe(95);
  });
  it("does not join different clubs, implements, sources or handedness into an improvement line", () => {
    for (const patch of [
      { clubId: "iron" },
      { implementLabel: "Light stick" },
      { source: "radar" },
      { handedness: "left" },
      { speedSystem: "other" },
    ]) {
      const result = selectMobileSpeedTrend(
        [session("other", { ...patch, sessionDateIso: "2026-09-03T12:00:00Z" }), session("latest")],
        now,
      );
      expect(result.points.map((p) => p.id)).toEqual(["latest"]);
    }
  });
  it("returns an honest empty state", () =>
    expect(selectMobileSpeedTrend([], now).points).toEqual([]));
});
