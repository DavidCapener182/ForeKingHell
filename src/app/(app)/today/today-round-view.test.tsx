import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/app/today-hydration-boundary", () => ({
  TodayHydrationBoundary: () => null,
}));
import { TodayRoundView } from "./today-round-view";
import type { TodayRound } from "@/lib/today-round-data";
describe("Today round view", () => {
  it("shows a scorecard-only round without borrowing practice data", () => {
    const round = {
      session: {
        id: "round-id",
        type: "real_round",
        date: new Date("2026-09-11T11:00:00Z"),
        courseName: "Ellesmere Port",
        notes: "Driver average 216 yd",
        scorecardJson: [
          {
            holeNumber: 1,
            par: 4,
            score: 5,
            yards: null,
            putts: null,
            fairwayHit: null,
            gir: null,
          },
        ],
      },
      tee: null,
    } as unknown as TodayRound;
    const html = renderToStaticMarkup(<TodayRoundView round={round} />);
    expect(html).toContain("Ellesmere Port");
    expect(html).toContain("11 September 2026");
    expect(html).toContain("Driver average 216 yd");
    expect(html).toContain("/rounds/round-id");
    expect(html).toContain("/today?view=practice");
    expect(html).not.toContain("Round stats");
    expect(html).not.toContain("Dispersion");
    expect(html).not.toContain("Trajectory");
    expect(html).not.toContain("max-w-6xl");
  });
});
