import { describe, expect, it } from "vitest";
import type { ShotMasterDetailRow } from "./shots-master-detail-table";
import { hasShotMetric, mobileShotMetrics, visibleShotSelection } from "./mobile-shot-evidence";

describe("mobile shot evidence", () => {
  it("hides every missing sentinel but retains a real zero and signed measurements", () => {
    for (const value of [undefined, null, "", "--", "—", "–", "n/a", "NaN", "Infinity"])
      expect(hasShotMetric(value)).toBe(false);
    for (const value of ["0", "-4.5", "2,400", "75%"]) expect(hasShotMetric(value)).toBe(true);
  });
  it("includes only recorded metrics with golf units", () => {
    const row = {
      totalLabel: "--",
      sideLabel: "-4.5",
      ballSpeedLabel: "124",
      clubSpeedLabel: "—",
      launchLabel: "17",
      launchDirectionLabel: "0",
      pathLabel: "--",
      faceLabel: "--",
      attackLabel: "-2",
      apexLabel: "84",
      smashLabel: "1.42",
      spinRateLabel: "2,400",
      spinAxisLabel: "--",
    } as ShotMasterDetailRow;
    expect(mobileShotMetrics(row)).toEqual([
      ["Side", "-4.5 yd"],
      ["Ball speed", "124 mph"],
      ["Launch", "17°"],
      ["Launch direction", "0°"],
      ["Attack", "-2°"],
      ["Apex", "84 ft"],
      ["Smash", "1.42"],
      ["Spin", "2,400 rpm"],
    ]);
    expect(mobileShotMetrics({ ...row, smashLabel: "1.4", smashFactor: 1.42 })).toContainEqual([
      "Smash",
      "1.42",
    ]);
  });
  it("never submits hidden or duplicate selected shots after results refresh", () => {
    expect(
      visibleShotSelection(
        ["old", "visible", "visible", "removed"],
        [{ id: "visible" }, { id: "new" }],
      ),
    ).toEqual(["visible"]);
    const rows = Array.from({ length: 60 }, (_, i) => ({ id: String(i) }));
    expect(
      visibleShotSelection(
        rows.map((r) => r.id),
        rows,
      ),
    ).toHaveLength(50);
  });
});
