import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoundMapHole, RoundMapShot } from "@/lib/round-map-projection";
import { MobileRoundShotMap } from "./mobile-round-shot-map";
const state = vi.hoisted(() => ({ query: new URLSearchParams() }));
const satellite = vi.hoisted(() => ({
  render: vi.fn<(props: Record<string, unknown>) => null>(() => null),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.query }));
vi.mock("./[sessionId]/lazy-round-shot-map", () => ({ LazyRoundShotMap: satellite.render }));
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
  satellite.render.mockClear();
});
afterEach(() => vi.unstubAllGlobals());
describe("mobile saved round map", () => {
  it("shares the URL selection with satellite and persists marker selections", () => {
    state.query = new URLSearchParams("hole=1&mapView=satellite&shot=second");
    const second = { ...shot, id: "second", holeShotNumber: 2 };
    renderToStaticMarkup(
      <MobileRoundShotMap holes={holes} shots={[shot, second]} courseName="Saved course" />,
    );
    const props = satellite.render.mock.calls.at(-1)![0];
    expect(props.activeShotId).toBe("second");
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        href: "https://golf.example/rounds/saved?view=map&mapView=satellite&shot=second",
      },
      history: { replaceState },
    });
    (props.onShotSelect as (id: string) => void)(shot.id);
    const updated = replaceState.mock.calls[0][2] as URL;
    expect(updated.searchParams.get("shot")).toBe(shot.id);
    expect(updated.searchParams.get("hole")).toBe("1");
    expect(updated.searchParams.get("mapView")).toBe("satellite");
  });
  it("keeps unplottable satellite shots in the list without inventing a marker", () => {
    state.query = new URLSearchParams("hole=1&mapView=satellite");
    const absent = { ...shot, id: "absent", totalYd: null };
    const remaining = { ...absent, id: "remaining", distanceRemainingYd: 50 };
    const html = renderToStaticMarkup(
      <MobileRoundShotMap
        holes={holes}
        shots={[shot, absent, remaining]}
        courseName="Saved course"
      />,
    );
    expect(
      (satellite.render.mock.calls.at(-1)![0].shots as RoundMapShot[]).map((s) => s.id),
    ).toEqual([shot.id, remaining.id]);
    expect(html).toContain("Distance unavailable");
    state.query.set("mapDistance", "carry");
    renderToStaticMarkup(
      <MobileRoundShotMap
        holes={holes}
        shots={[shot, absent, remaining]}
        courseName="Saved course"
      />,
    );
    expect(
      (satellite.render.mock.calls.at(-1)![0].shots as RoundMapShot[]).map((s) => s.id),
    ).toEqual([shot.id]);
  });
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
