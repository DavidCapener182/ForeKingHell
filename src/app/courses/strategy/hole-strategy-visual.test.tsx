import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildHoleStrategies } from "@/lib/course-strategy";
import type { CourseStrategyMap } from "@/lib/course-strategy-map";
import { HoleStrategyVisual } from "./hole-strategy-visual";

const [strategy] = buildHoleStrategies({
  holes: [{ holeNumber: 1, par: 4, yards: 382 }],
  hazardsByHole: new Map([[1, ["bunker"]]]),
  clubs: [
    {
      clubId: "driver",
      label: "Driver",
      carryYd: 245,
      minCarryYd: 235,
      maxCarryYd: 255,
      leftYd: 6,
      rightYd: 24,
      confidence: 0.8,
      sampleSize: 30,
    },
    {
      clubId: "wood",
      label: "5 Wood",
      carryYd: 200,
      minCarryYd: 194,
      maxCarryYd: 206,
      leftYd: 3,
      rightYd: 7,
      confidence: 0.8,
      sampleSize: 30,
    },
  ],
});
const map: CourseStrategyMap = {
  imageUrl: null,
  attribution: null,
  bounds: { minX: -40, maxX: 40, minZ: -400, maxZ: 0 },
  holes: [
    {
      holeNumber: 1,
      tee: [0, 0],
      green: [0, -350],
      centerline: [
        [0, 0],
        [0, -350],
      ],
    },
  ],
  features: [],
};
const normal = strategy.strategyModes.find((m) => m.id === "normal")!;
const aggressive = strategy.strategyModes.find((m) => m.id === "aggressive")!;
function draw(mode = normal, compact = true, courseMap: CourseStrategyMap | null = map) {
  return renderToStaticMarkup(
    <HoleStrategyVisual strategy={strategy} mode={mode} compact={compact} courseMap={courseMap} />,
  );
}
function ellipse(html: string) {
  const tag = html.match(/<ellipse[^>]*data-personal-dispersion[^>]*>/)?.[0] ?? "";
  return Object.fromEntries(
    ["rx", "ry", "cx", "cy"].map((key) => [
      key,
      Number(tag.match(new RegExp(`${key}="([^"]+)"`))?.[1]),
    ]),
  );
}
describe("mobile hole map evidence", () => {
  it("switches to the selected club's lateral and carry spread at the map scale", () => {
    const wood = ellipse(draw());
    const driver = ellipse(draw(aggressive));
    expect(driver.rx / wood.rx).toBeCloseTo(3);
    expect(driver.ry / wood.ry).toBeCloseTo(20 / 12);
    expect(wood.rx).toBeLessThan(24); // No visual minimum that exaggerates measured width.
    expect(draw(aggressive)).toContain("Dispersion is 6 yards left and 24 yards right");
  });
  it("never substitutes a normal-club or default ellipse for unavailable option evidence", () => {
    const unavailable = {
      ...normal,
      evidence: { ...normal.evidence!, leftYd: null, rightYd: null },
    };
    expect(draw(unavailable)).not.toContain("data-personal-dispersion");
    expect(draw(unavailable)).toContain("Dispersion unavailable");
    expect(
      draw({ ...normal, evidence: { ...normal.evidence!, carryRangeMeasured: false } }),
    ).not.toContain("data-personal-dispersion");
  });
  it("does not invent a mobile course map when geometry is absent", () => {
    expect(draw(normal, true, null)).toContain("Hole map unavailable");
    expect(draw(normal, true, null)).not.toContain('role="img"');
    expect(draw(normal, false, null)).toContain("Illustrative fallback");
  });
  it("preserves the existing workbench overlay when changing strategy option", () => {
    expect(ellipse(draw(normal, false)).rx).toBe(ellipse(draw(aggressive, false)).rx);
    expect(draw(normal, false)).toContain("personal range");
  });
});
