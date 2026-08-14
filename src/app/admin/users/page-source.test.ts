import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/users/page.tsx"), "utf8");

describe("admin users desktop console source", () => {
  it("uses the shared workbench shell without adding a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="admin-users">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps the admin users table exportable, configurable and keyboard reachable", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("DataTableFrame");
    expect(source).toContain('viewKey="admin-users"');
    expect(source).toContain('scope="admin-users"');
    expect(source).toContain('exportTableId="admin-users"');
    expect(source).toContain('exportFileName="forekinghell-admin-users-view.csv"');
    expect(source).toContain("mainTable");
    expect(source).toContain('mainTableLabel="Admin user accounts table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('data-workbench-scope="admin-users"');
    expect(source).toContain('data-workbench-export-table="admin-users"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("<a\n      href={adminUserSortHref");
    expect(source).not.toContain('from "next/link"');

    for (const column of ["user", "plan", "activity", "admin", "created", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps high-impact admin access changes behind a confirmation", () => {
    expect(source).toContain("AdminConfirmSubmitButton");
    expect(source).toContain('confirmTitle="Grant lifetime full access"');
    expect(source).toContain("creates a permanent full-plan entitlement");
    expect(source).toContain('confirmTitle="Grant admin access"');
    expect(source).toContain("Owner and operator roles can change platform operations");
    expect(source).toContain("AdminUserActions");
  });

  it("excludes companion search and grant sheets from the desktop-only route", () => {
    for (const obsolete of [
      "AdminMobileShell",
      "AdminMobileUsers",
      "MobileUserTools",
      "MobileAdminUserRows",
      "BottomSheet",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });
});
