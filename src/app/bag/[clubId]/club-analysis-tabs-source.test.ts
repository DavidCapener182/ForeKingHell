import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-analysis-tabs.tsx"),
  "utf8",
);

describe("club profile desktop shot evidence table", () => {
  it("keeps club profile shots in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="club-shot-evidence-table"');
    expect(source).toContain('data-workbench-scope="club-shot-evidence"');
    expect(source).toContain('data-workbench-export-table="club-shot-evidence"');
    expect(source).toContain('mainTableLabel="Club shot evidence table"');
    expect(source).toContain("Shot evidence table");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("onClick={() => onSelect(shot.id)}");
  });

  it("keeps the club profile focused on data rather than a full AI slab", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps club profile charts labelled and backed by accessible fallback tables", () => {
    expect(source).toContain("ChartAccessibleFallback");
    expect(source).toContain("title={`${clubType} dispersion map`}");
    expect(source).toContain("summary={dispersionFallbackSummary");
    expect(source).toContain(
      "rows={dispersionFallbackRows(plottedShots, selectedShotId, distanceView)}",
    );
    expect(source).toContain('role="img"');
    expect(source).toContain('aria-label="Club trajectory"');
    expect(source).toContain('title="Club trajectory"');
    expect(source).toContain("summary={trajectoryFallbackSummary");
    expect(source).toContain("rows={trajectoryFallbackRows(trajectoryShots, selectedShotId)}");
  });
});
