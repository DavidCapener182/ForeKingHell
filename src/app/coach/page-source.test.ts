import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/coach/page.tsx"), "utf8");

describe("coach desktop evidence workbench", () => {
  it("keeps coach evidence as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="coach-evidence"');
    expect(source).toContain('scope="coach-evidence"');
    expect(source).toContain('data-workbench-scope="coach-evidence"');
    expect(source).toContain('exportTableId="coach-evidence"');
    expect(source).toContain('data-workbench-export-table="coach-evidence"');
    expect(source).toContain('mainTableLabel="Coach evidence table"');
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
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the contextual AI coach rail and prompt controls", () => {
    expect(source).toContain("DesktopInsightRail");
    expect(source).toContain('title="AI coach rail"');
    expect(source).toContain("coachWorkbenchPrompts");
    expect(source).not.toContain('railBreakpoint="wide"');
    expect(source).toContain("rail={");
  });
});
