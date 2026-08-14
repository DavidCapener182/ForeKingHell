import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/billing/page.tsx"), "utf8");

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
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("<a\n      href={`/admin/billing?sort=${metric}&dir=${nextDir}`}");
    expect(source).not.toContain('from "next/link"');

    for (const column of ["user", "plan", "status", "renews", "created"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps lifetime billing grants behind a confirmation", () => {
    expect(source).toContain("AdminConfirmSubmitButton");
    expect(source).toContain('confirmTitle="Grant lifetime full access"');
    expect(source).toContain("creates a permanent full-plan entitlement");
    expect(source).toContain('confirmActionLabel="Grant full access"');
  });

  it("excludes companion-only billing code from the desktop-only admin route", () => {
    for (const obsolete of [
      "AdminMobileShell",
      "AdminMobileBilling",
      "MobileBillingGrant",
      "MobileTabBar",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });
});
