import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/billing/page.tsx"), "utf8");

describe("admin billing desktop console source", () => {
  it("uses the shared billing workbench shell without adding a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain(
      '<DesktopWorkbenchLayout scope="admin-billing" className="hidden lg:grid">',
    );
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

  it("prioritises billing failures in a segmented native mobile directory", () => {
    expect(source).toContain("AdminMobileShell");
    expect(source).toContain("AdminMobileBilling");
    expect(source).toContain("MobileBillingGrant");
    expect(source).toContain("MobileTabBar");
    expect(source).toContain("IOSDisclosureGroup");
    expect(source).toContain("billingAttentionStatuses");
  });
});
