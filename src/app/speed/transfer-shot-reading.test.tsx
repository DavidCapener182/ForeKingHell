import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TransferShotReading } from "./transfer-shot-reading";

const corridor = { minSideCarryYd: -20, maxSideCarryYd: 20 };
const render = (sideCarryYd: number | null) =>
  renderToStaticMarkup(
    <TransferShotReading
      shot={{ shotNumber: null, clubSpeedMph: 95, sideCarryYd }}
      position={3}
      corridor={corridor}
    />,
  );

describe("speed transfer reading", () => {
  it("keeps missing readings inconclusive, never outside the target", () => {
    for (const value of [null, Number.NaN]) {
      const html = render(value);
      expect(html).toContain("Lateral reading unavailable");
      expect(html).toContain("Inconclusive");
      expect(html).not.toContain("Outside");
      expect(html).toContain("Shot 3");
    }
  });
  it("preserves measured zero and the inclusive corridor boundaries", () => {
    expect(render(0)).toContain("0.0 yd · Inside");
    expect(render(-20)).toContain("-20.0 yd · Inside");
    expect(render(20)).toContain("+20.0 yd · Inside");
    expect(render(20.1)).toContain("+20.1 yd · Outside");
  });
});
