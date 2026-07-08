import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rounds/rounds-workspace.tsx"), "utf8");

describe("rounds desktop workspace source", () => {
  it("keeps round history as a controlled desktop workbench table", () => {
    expect(source).toContain("DesktopWorkbenchControls");
    expect(source).toContain('viewKey="rounds"');
    expect(source).toContain('scope="rounds"');
    expect(source).toContain('exportTableId="rounds"');
    expect(source).toContain('exportFileName="forekinghell-rounds-view.csv"');
    expect(source).toContain('data-workbench-export-table="rounds"');
    expect(source).toContain('mainTableLabel="Round history table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain('aria-label="Round filters"');
    expect(source).toContain("data-filter-search");
    expect(source).toContain("data-page-search");

    for (const column of ["round", "date", "type", "score", "diff", "putts", "data", "actions"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
