import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-analysis-tabs.tsx"),
  "utf8",
);

describe("club profile desktop shot evidence table", () => {
  it("uses one-level phone disclosures and flat shot evidence around the specialist canvases", () => {
    expect(source).toContain("mobileSupport?: ReactNode");
    expect(source).toContain("<IOSDisclosureGroup");
    expect(source).toContain('title: "Club intelligence"');
    expect(source).toContain('title: "Trajectory"');
    expect(source).toContain('title: "Measured shot evidence"');
    expect(source).toContain("MobileShotEvidenceRows");
    expect(source).toContain("data-mobile-shot-evidence");
    expect(source).toContain('className="hidden space-y-5 lg:block"');
    expect(source).toContain('className="hidden scroll-mt-28 gap-3 lg:grid"');
  });

  it("keeps club profile shots in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="club-shot-evidence-table"');
    expect(source).toContain('data-workbench-scope="club-shot-evidence"');
    expect(source).toContain('data-workbench-export-table="club-shot-evidence"');
    expect(source).toContain('mainTableLabel="Club shot evidence table"');
    expect(source).toContain('mainTableLabel="Club shot evidence table" stickyFirstColumn');
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
