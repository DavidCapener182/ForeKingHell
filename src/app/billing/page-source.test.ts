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

  it("excludes the obsolete companion membership graph from the desktop-only route", () => {
    for (const obsolete of [
      "MobileAppShell",
      "IOSGroupedList",
      "IOSDisclosureGroup",
      "activePlanLimits",
      "primaryActivePlanLimits",
      "getRequestAppSurface",
      'surface === "companion"',
      "hidden lg:contents",
    ]) {
      expect(source).not.toContain(obsolete);
    }
    expect(source).toContain('<DesktopWorkbenchLayout scope="billing">');
  });

  it("keeps checkout controls at a practical touch size", () => {
    expect(source).toContain('<Select name="interval"');
    expect(source).toContain('className="min-h-11 w-full"');
    expect(source).toContain('className="min-h-11"');
    expect(source).not.toContain("ready for desktop review");
  });

  it("routes every cancellation or downgrade handoff through the AlertDialog", () => {
    const dialog = readFileSync(
      join(process.cwd(), "src/app/billing/billing-manage-dialog.tsx"),
      "utf8",
    );

    expect(source.match(/<BillingManageDialog/g)).toHaveLength(1);
    expect(source).not.toContain("<form action={openCustomerPortalAction}");
    expect(dialog).toContain("<AlertDialog>");
    expect(dialog).toContain("downgrade, cancel at period end");
    expect(dialog).toContain("No plan changes happen until you confirm them there");
  });
});
