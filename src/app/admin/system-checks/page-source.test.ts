import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/system-checks/page.tsx"),
  "utf8",
);

describe("admin system checks desktop console source", () => {
  it("adds a protected provider health and system checks console", () => {
    expect(source).toContain("getAdminOperationsSnapshot");
    expect(source).toContain('<AdminNav active="/admin/system-checks" />');
    expect(source).toContain('scope="admin-system-checks"');
    expect(source).toContain("Provider health and platform checks");
    expect(source).toContain("Provider failures");
    expect(source).toContain("Billing failures");
    expect(source).toContain("RLS/test status");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("adminSystemCheckColumns");
    expect(source).toContain("adminSystemCheckViews");
    expect(source).toContain("buildSystemCheckRows");
    expect(source).toContain('viewKey="admin-system-checks"');
    expect(source).toContain('scope="admin-system-checks"');
    expect(source).toContain('exportTableId="admin-system-checks"');
    expect(source).toContain('data-workbench-scope="admin-system-checks"');
    expect(source).toContain('data-workbench-export-table="admin-system-checks"');
    expect(source).toContain("mainTable");
    expect(source).toContain('mainTableLabel="Admin system checks table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('id="admin-system-checks-summary"');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('href="/providers#provider-health"');
    expect(source).toContain('href="/providers#provider-jobs"');
    expect(source).toContain('href: "/admin/billing"');
    expect(source).toContain('href: "/admin/moderation"');

    for (const column of ["check", "area", "status", "count", "impact", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps admin recommendations tied to visible evidence", () => {
    expect(source).toContain("Admin recommendations should cite visible provider counts");
    expect(source).toContain("Do not infer a provider outage from missing data alone");
    expect(source).toContain("only active owner or operator");
    expect(source).not.toContain("DesktopInsightRail");
  });
});
