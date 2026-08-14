import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/users/page.tsx"), "utf8");
const actionsSource = readFileSync(
  join(process.cwd(), "src/app/admin/admin-user-actions.tsx"),
  "utf8",
);

describe("admin users desktop console source", () => {
  it("uses the shared workbench shell without adding a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="admin-users"');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("uses a full-width table with the requested account-management columns", () => {
    expect(source).toContain("DataTableFrame");
    expect(source).toContain("mainTable");
    expect(source).toContain('mainTableLabel="Admin user accounts table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("min-w-[1180px]");
    expect(source).toContain('data-workbench-scope="admin-users"');
    expect(source).toContain('data-workbench-export-table="admin-users"');
    expect(source).toContain("<TableCaption");

    for (const column of ["user", "email", "plan", "activity", "admin", "created", "action"]) {
      expect(source + actionsSource).toContain(`data-column="${column}"`);
    }
  });

  it("places search, role, plan, status and sort in one toolbar", () => {
    expect(source).toContain('aria-label="Filter admin users"');
    for (const control of [
      'label="Search"',
      'label="Role"',
      'label="Plan"',
      'label="Status"',
      'label="Sort"',
    ]) {
      expect(source).toContain(control);
    }
    expect(source).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain('title="Grant lifetime full"');
    expect(source).not.toContain('title="Add admin operator"');
  });

  it("keeps account actions in Dialog and Sheet flows with destructive confirmation", () => {
    expect(source).toContain("AdminUserActions");
    expect(source).toContain("AdminAccessDialog");
    expect(actionsSource).toContain("<DropdownMenu");
    expect(actionsSource).toContain("<Dialog>");
    expect(actionsSource).toContain("<Sheet");
    expect(actionsSource).toContain("Identity");
    expect(actionsSource).toContain("Recent activity");
    expect(actionsSource).toContain("Account controls");
    expect(actionsSource).toContain("Audit context");
    expect(actionsSource).toContain("AdminConfirmSubmitButton");
    expect(actionsSource).toContain('confirmTitle="Grant lifetime full access"');
    expect(actionsSource).toContain('confirmTitle="Grant admin access"');
    expect(actionsSource).toContain("<AlertDialog");
    expect(actionsSource).toContain("Deactivate admin");
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
