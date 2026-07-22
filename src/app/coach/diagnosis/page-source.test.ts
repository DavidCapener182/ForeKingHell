import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/coach/diagnosis/page.tsx"), "utf8");

describe("coach diagnosis desktop workbench", () => {
  it("turns the deep diagnosis page into an exportable evidence workbench", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="coach-diagnosis">');
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="coach-diagnosis-evidence"');
    expect(source).toContain('scope="coach-diagnosis-evidence"');
    expect(source).toContain('data-workbench-scope="coach-diagnosis-evidence"');
    expect(source).toContain('exportTableId="coach-diagnosis-evidence"');
    expect(source).toContain('exportFileName="forekinghell-coach-diagnosis.csv"');
    expect(source).toContain('data-workbench-export-table="coach-diagnosis-evidence"');
    expect(source).toContain('mainTableLabel="Coach diagnosis evidence table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "club",
      "issue",
      "trust",
      "sample",
      "stock",
      "playable",
      "miss",
      "drill",
      "retest",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the deep diagnosis page focused instead of adding a contextual AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
