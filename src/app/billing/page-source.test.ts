import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/billing/page.tsx"), "utf8");

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
    expect(source).toContain('mainTableLabel="Billing plan limits table" stickyFirstColumn');
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

  it("puts the current membership and entitlements before collapsed plan comparisons on mobile", () => {
    const currentPlan = source.indexOf('aria-label="Current membership"');
    const includedAccess = source.indexOf('title="Included access"');
    const comparePlans = source.indexOf('title="Compare plans"');

    expect(currentPlan).toBeGreaterThan(0);
    expect(includedAccess).toBeGreaterThan(currentPlan);
    expect(comparePlans).toBeGreaterThan(includedAccess);
    expect(source).toContain("IOSGroupedList");
    expect(source).toContain("IOSDisclosureGroup");
    expect(source).toContain("activePlanLimits");
    expect(source).toContain("primaryActivePlanLimits");
    expect(source).toContain('title: "All plan entitlements"');
    expect(source).toContain("hidden lg:contents");
  });

  it("keeps mobile checkout controls at a practical touch size", () => {
    expect(source).toContain('className="min-h-11 rounded-lg border bg-background px-3 text-sm"');
    expect(source).toContain('className="min-h-11"');
    expect(source).not.toContain("ready for desktop review");
  });
});
