import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/admin/challenges/page.tsx"), "utf8");

describe("admin challenges desktop console source", () => {
  it("uses the shared challenge operations workbench without adding a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="admin-challenges">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps challenge boards as an exportable admin table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="admin-challenges"');
    expect(source).toContain('scope="admin-challenges"');
    expect(source).toContain('exportTableId="admin-challenges"');
    expect(source).toContain('exportFileName="forekinghell-admin-challenges-view.csv"');
    expect(source).toContain('data-main-table-target="true"');
    expect(source).toContain('aria-label="Challenge boards table"');
    expect(source).toContain('data-workbench-export-table="admin-challenges"');
    expect(source).toContain("<caption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["challenge", "owner", "status", "participation", "ends", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
