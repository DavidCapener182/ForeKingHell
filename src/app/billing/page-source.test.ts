import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/billing/page.tsx"), "utf8");

describe("billing desktop plan limits ledger", () => {
  it("uses the billing artwork variant in the desktop platform hero", () => {
    expect(source).toContain('variant="billing"');
    expect(source).toContain('sizes="192px"');
    expect(source).toContain("priority");
  });

  it("keeps plan limits as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="billing-limits"');
    expect(source).toContain('scope="billing-limits"');
    expect(source).toContain('data-workbench-scope="billing-limits"');
    expect(source).toContain('exportTableId="billing-limits"');
    expect(source).toContain('data-workbench-export-table="billing-limits"');
    expect(source).toContain('mainTableLabel="Billing plan limits table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["plan", "limit", "value", "status"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("does not add the contextual AI rail to billing", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
