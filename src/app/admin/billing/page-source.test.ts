import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/admin/billing/page.tsx"), "utf8");

describe("admin billing desktop console source", () => {
  it("uses the shared billing workbench shell without adding a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="admin-billing">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps subscriptions as an exportable admin table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("DataTableFrame");
    expect(source).toContain('viewKey="admin-billing"');
    expect(source).toContain('scope="admin-billing"');
    expect(source).toContain('exportTableId="admin-billing"');
    expect(source).toContain('exportFileName="forekinghell-admin-billing-view.csv"');
    expect(source).toContain("mainTable");
    expect(source).toContain('mainTableLabel="Subscriptions table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('data-workbench-scope="admin-billing"');
    expect(source).toContain('data-workbench-export-table="admin-billing"');
    expect(source).toContain("<caption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["user", "plan", "status", "renews", "created"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
