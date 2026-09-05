import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoundMapHole, RoundMapShot } from "@/lib/round-map-projection";
import { MobileRoundShotMap } from "./mobile-round-shot-map";
const state = vi.hoisted(() => ({ query: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.query }));
const holes: RoundMapHole[] = [
  {
    holeNumber: 1,
    par: 4,
    yards: 350,
    score: 4,
    putts: 2,
    geometry: [
      [53, -3],
      [53.002, -3],
    ],
  },
  {
    holeNumber: 2,
    par: 3,
    yards: 150,
    score: null,
    putts: null,
    geometry: [
      [53.002, -3],
      [53.004, -3],
    ],
  },
];
const shot: RoundMapShot = {
  id: "real-shot",
  holeNumber: 1,
  holeShotNumber: 1,
  shotNumber: 1,
  clubType: "7i",
  carryYd: null,
  totalYd: 148,
  sideCarryYd: null,
  distanceRemainingYd: null,
  courseHoleYards: 350,
};
beforeEach(() => {
  state.query = new URLSearchParams();
});
describe("mobile saved round map", () => {
  it("shows one hole, measured rows and an honest carry fallback", () => {
    state.query = new URLSearchParams("hole=1&mapDistance=carry");
    const html = renderToStaticMarkup(
      <MobileRoundShotMap holes={holes} shots={[shot]} courseName="Saved course" />,
    );
    expect(html).toContain("148 yd");
    expect(html).toContain("total · carry unavailable");
    expect(html).toContain("7 Iron");
    expect(html).toContain("projected shots");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Actual hole overlay");
    expect(html).toContain('aria-label="Map hole"');
    expect(html).toContain('aria-label="Next hole"');
  });
  it("recovers the requested empty hole without borrowing another hole's shots", () => {
    state.query = new URLSearchParams("hole=2&shot=real-shot");
    const html = renderToStaticMarkup(
      <MobileRoundShotMap holes={holes} shots={[shot]} courseName="Saved course" />,
    );
    expect(html).toContain("No measured shots are linked to this hole.");
    expect(html).not.toContain("148 yd");
    expect(html).toContain('value="2" selected=""');
  });
  it("labels scorecard markers as estimates and does not plot absent distances", () => {
    const html = renderToStaticMarkup(
      <MobileRoundShotMap
        holes={holes}
        shots={[{ ...shot, totalYd: null }]}
        courseName="Saved course"
        shotMode="estimated"
      />,
    );
    expect(html).toContain("Estimated strokes · scorecard only");
    expect(html).toContain("Distance unavailable");
    expect(html).toContain("0 projected estimated strokes");
    expect(html).not.toContain("148 yd");
  });
});
