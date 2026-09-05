import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobilePerformanceComparisonView } from "./mobile-performance-comparison";
import type { MobilePerformanceComparison } from "@/lib/mobile-progress-story";

const state = vi.hoisted(() => ({ query: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.query }));
const snapshot = {
  label: "Session",
  shotCount: 10,
  carryMedianYd: 150,
  absoluteOfflineAverageYd: 10,
  ballSpeedAverageMph: null,
  launchAverageDeg: null,
  clubPathAverageDeg: null,
};
const comparisons: MobilePerformanceComparison[] = ["first", "second"].map((clubId) => ({
  clubId,
  clubType: "7i",
  brandModel: clubId === "first" ? "Original iron" : "Replacement iron",
  previous: snapshot,
  latest: {
    ...snapshot,
    carryMedianYd: clubId === "first" ? 151 : 154,
    absoluteOfflineAverageYd: null,
  },
  change: {
    label: "Session change",
    carryDeltaYd: clubId === "first" ? 1 : 4,
    offlineDeltaYd: null,
    ballSpeedDeltaMph: null,
    launchDeltaDeg: null,
    clubPathDeltaDeg: null,
  },
}));
const draw = () =>
  renderToStaticMarkup(
    <MobilePerformanceComparisonView
      comparisons={comparisons}
      initialClubId="first"
      initialMeasure="side"
    />,
  );

describe("mobile performance comparison navigation", () => {
  it("restores the equipment identity and measure from a detail return URL", () => {
    state.query = new URLSearchParams("compareClub=second&compareMeasure=carry");
    const html = draw();
    expect(html).toContain('href="/bag/second"');
    expect(html).toContain("4 yd longer carry");
    expect(html).toContain("7 Iron · Original iron");
    expect(html).toContain("7 Iron · Replacement iron");
  });
  it("falls back to available evidence for stale identities and unavailable measures", () => {
    state.query = new URLSearchParams("compareClub=removed&compareMeasure=side");
    const html = draw();
    expect(html).toContain('href="/bag/first"');
    expect(html).toContain("latest median carry");
    expect(html).not.toContain("latest average lateral miss");
    expect(html).not.toContain("NaN");
  });
});
