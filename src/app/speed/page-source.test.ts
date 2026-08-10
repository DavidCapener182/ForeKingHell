import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/speed/page.tsx"), "utf8");

describe("speed centre desktop evidence ledger", () => {
  it("keeps the wider distance-loss diagnosis out of the speed workbench", () => {
    expect(source).not.toContain("DistanceLossDiagnosisPanel");
    expect(source).not.toContain("What is driving the distance loss?");
  });

  it("uses the speed artwork variant in the desktop header", () => {
    expect(source).toContain('variant="speed"');
    expect(source).toContain("visual={<PageArtwork");
    expect(source).toContain("min-h-36");
  });

  it("keeps recent speed evidence in an exportable desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="speed-evidence"');
    expect(source).toContain('scope="speed"');
    expect(source).toContain('exportTableId="speed-evidence"');
    expect(source).toContain('data-workbench-scope="speed"');
    expect(source).toContain('data-workbench-export-table="speed-evidence"');
    expect(source).toContain('mainTableLabel="Speed evidence session ledger"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("forekinghell-speed-evidence.csv");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");
    expect(source).toContain("SpeedEvidenceCard");

    for (const column of [
      "session",
      "date",
      "source",
      "count",
      "avg",
      "max",
      "min",
      "target",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("does not add a persistent AI rail to the speed centre", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
