import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/system-checks/page.tsx"),
  "utf8",
);

const dataSource = readFileSync(join(process.cwd(), "src/app/admin/admin-system-data.ts"), "utf8");
const retrySource = readFileSync(
  join(process.cwd(), "src/app/admin/admin-retry-button.tsx"),
  "utf8",
);
describe("admin system checks desktop console source", () => {
  it("loads protected operational evidence and preserves dated history", () => {
    expect(source).toContain("getAdminOperationsSnapshot()");
    expect(source).toContain("getAdminSystemCheckHistory()");
    expect(source).toContain('<AdminNav active="/admin/system-checks" />');
    expect(source).toContain('title="System health console"');
    expect(source).toContain("buildSystemCheckRows(operations)");
    expect(source).toContain("buildHealthRows(operations)");
    expect(source).toContain('rows.filter((r) => r.state === "failure")');
    expect(source).toContain('rows.filter((r) => r.state === "unverified")');
    expect(source).toContain("Recorded failures need review");
    expect(source).toContain("<AdminSystemRegister rows={rows} />");
    expect(source).toContain('aria-label="Recorded check history"');
    expect(source).toContain("record.createdAt.toISOString()");
    expect(source).toContain("JSON.stringify(record.metadataJson, null, 2)");
    expect(source).toContain("No recorded-check snapshots yet.");

    const adminSource = readFileSync(join(process.cwd(), "src/lib/admin.ts"), "utf8");
    const historySource = readFileSync(
      join(process.cwd(), "src/lib/admin-system-checks.ts"),
      "utf8",
    );
    expect(adminSource).toMatch(
      /export async function getAdminOperationsSnapshot\(\)\s*\{\s*await requireAdminUser\(\)/,
    );
    expect(historySource).toMatch(
      /export async function getAdminSystemCheckHistory\(\)\s*\{\s*await requireAdminUser\(\)/,
    );

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
      expect(dataSource).toContain(`label: "${area}"`);
    }
    for (const href of [
      "/providers?tab=diagnostics#provider-health",
      "/providers?tab=diagnostics#provider-jobs",
      "/admin/billing",
    ]) {
      expect(dataSource).toContain(`href: "${href}"`);
    }
  });

  it("retains export, saved-view and column controls in the extracted health register", () => {
    const register = readFileSync(
      join(process.cwd(), "src/app/admin/admin-system-register.tsx"),
      "utf8",
    );
    expect(register).toContain("<DesktopWorkbenchControls");
    expect(register).toContain('viewKey="admin-system-health"');
    expect(register).toContain('scope="admin-system-health"');
    expect(register).toContain('data-workbench-scope="admin-system-health"');
    expect(register).toContain('data-workbench-export-table="admin-system-health"');
    expect(register).toContain('exportFileName="admin-system-health-filtered.csv"');
    expect(register).toContain('aria-label="Health register table"');
    expect(register).toContain("tabIndex={0}");
    expect(register).toContain("shown.map((r) => (");
    for (const column of ["check", "result", "evidence", "lastCheck", "diagnostics"]) {
      expect(register).toContain(`data-column="${column}"`);
    }
    for (const key of ["healthQuery", "healthState", "healthOrder"]) {
      expect(register).toContain(`params.get("${key}")`);
    }
    expect(register).toContain("<ResponsiveDetailPanel");
    expect(register).toContain("Impact: row.impact");
    expect(register).toContain("<Link href={row.href} prefetch={false}>");
  });

  it("keeps admin recommendations tied to visible evidence", () => {
    expect(source).toContain("Live health remains unverified");
    expect(retrySource).toContain(
      "This does not retry imports, charge payments or test live external services.",
    );
    expect(source).toContain("snapshot, not a live provider check.");
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
    expect(dataSource).toContain("No live verification result");
    expect(source).not.toContain('"Healthy"');
    expect(source).not.toContain("Runbook ready");
  });
});
