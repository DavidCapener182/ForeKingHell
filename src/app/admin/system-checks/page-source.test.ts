import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/system-checks/page.tsx"),
  "utf8",
);

describe("admin system checks desktop console source", () => {
  it("adds a protected evidence-led system health console", () => {
    expect(source).toContain("getAdminOperationsSnapshot");
    expect(source).toContain('<AdminNav active="/admin/system-checks" />');
    expect(source).toContain('scope="admin-system-checks"');
    expect(source).toContain("System health console");
    expect(source).toContain("Overall state");
    expect(source).toContain("Needs attention");
    expect(source).toContain("No failures flagged");
    expect(source).toContain("Unchecked does not mean working");
    expect(source).toContain("Live verification coverage");
    expect(source).toContain("Main incident timeline");
    expect(source).toContain("Full system check table");
    expect(source).toContain("HealthStatusBadge");
    expect(source).toContain("<Card");
    expect(source).toContain("<Progress");
    expect(source).toContain("<Item");
    expect(source).toContain("<Badge");
    expect(source).toContain("<Alert");
    expect(source).toContain("<StatusTimeline");
    expect(source).toContain("<Table");
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
    expect(source).toContain('href="/providers?tab=diagnostics#provider-health"');
    expect(source).toContain('href: "/providers?tab=diagnostics#provider-jobs"');
    expect(source).toContain('href: "/admin/billing"');

    for (const column of ["check", "area", "status", "lastCheck", "evidence", "impact", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }

    for (const area of [
      "Provider",
      "Imports",
      "Billing",
      "Auth",
      "RLS",
      "AI",
      "Storage",
      "External connections",
    ]) {
      expect(source).toContain(`label: "${area}"`);
    }
  });

  it("keeps admin recommendations tied to visible evidence", () => {
    expect(source).toContain("what the platform actually checked");
    expect(source).toContain("It does not run live service, CI");
    expect(source).toContain("no inferred service state");
    expect(source).not.toContain("DesktopInsightRail");
  });

  it("keeps honest absent-state copy without bundling a second companion register", () => {
    for (const obsolete of [
      "AdminMobileShell",
      "AdminMobileSystemChecks",
      "MobileSystemCheckRows",
      "MobileStatusAction",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
    expect(source).toContain("No live verification result");
    expect(source).not.toContain('"Healthy"');
    expect(source).not.toContain("Runbook ready");
  });
});
