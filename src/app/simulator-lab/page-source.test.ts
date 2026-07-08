import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/simulator-lab/page.tsx"), "utf8");

describe("simulator lab desktop workbench", () => {
  it("keeps simulator session deltas as an exportable desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("sessionDeltaColumns");
    expect(source).toContain("sessionDeltaSuggestedViews");
    expect(source).toContain('id="simulator-session-deltas"');
    expect(source).toContain('data-workbench-scope="simulator-session-deltas"');
    expect(source).toContain('viewKey="simulator-session-deltas"');
    expect(source).toContain("suggestedViews={sessionDeltaSuggestedViews}");
    expect(source).toContain('href: "/simulator-lab#simulator-session-deltas"');
    expect(source).toContain("Latest simulator changes");
    expect(source).toContain("Offline control check");
    expect(source).toContain('exportTableId="simulator-session-deltas"');
    expect(source).toContain('data-workbench-export-table="simulator-session-deltas"');
    expect(source).toContain('mainTableLabel="Simulator session delta table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-simulator-session-deltas.csv");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["club", "samples", "carry", "ball", "smash", "offline", "verdict"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps equipment impact as an exportable desktop workbench table", () => {
    expect(source).toContain("equipmentImpactColumns");
    expect(source).toContain("equipmentImpactSuggestedViews");
    expect(source).toContain('id="simulator-equipment-impact"');
    expect(source).toContain('data-workbench-scope="simulator-equipment-impact"');
    expect(source).toContain('viewKey="simulator-equipment-impact"');
    expect(source).toContain("suggestedViews={equipmentImpactSuggestedViews}");
    expect(source).toContain('href: "/simulator-lab#simulator-equipment-impact"');
    expect(source).toContain("Before/after equipment proof");
    expect(source).toContain("Equipment regressions");
    expect(source).toContain('exportTableId="simulator-equipment-impact"');
    expect(source).toContain('data-workbench-export-table="simulator-equipment-impact"');
    expect(source).toContain('label="Simulator equipment impact table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-simulator-equipment-impact.csv");

    for (const column of ["change", "samples", "carry", "ball", "smash", "offline", "verdict"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps simulator lab table and tool focused without a persistent AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });
});
