import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/billing/page.tsx"), "utf8");

describe("admin billing desktop console source", () => {
  it("uses the shared billing workbench shell without adding a contextual AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<AdminNav active="/admin/billing" />');
    expect(source).toContain("Promise.all([requireAdminUser(), getAdminBillingData()])");
    expect(source.match(/<PageShell>/g)).toHaveLength(1);
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps subscriptions and entitlements independently exportable and configurable", () => {
    const ledger = readFileSync(
      join(process.cwd(), "src/app/admin/admin-billing-ledger.tsx"),
      "utf8",
    );
    expect(source).toContain('scope="admin-billing-subscriptions"');
    expect(source).toContain('scope="admin-billing-entitlements"');
    expect(ledger).toContain("<DesktopWorkbenchControls");
    expect(ledger).toContain("viewKey={scope}");
    expect(ledger).toContain("scope={scope}");
    expect(ledger).toContain("data-workbench-scope={scope}");
    expect(ledger).toContain("data-workbench-export-table={scope}");
    expect(ledger).toContain("exportFileName={`${scope}-filtered.csv`}");
    expect(ledger).toContain("localView={{ state: { query, sort, direction }, restore: update }}");
    expect(ledger).toContain("url.searchParams.set(`${scope}-${key}`, value)");
    expect(ledger).toContain("shown.map((row) => (");
    expect(ledger).toContain("Object.keys(row.fields)");
    expect(ledger).toContain("data-column={fieldColumn(field)}");
    expect(ledger).toContain("row.fields[field]");
    for (const column of [
      "account",
      "email",
      "state",
      "date",
      "record-id",
      "account-id",
      "details",
    ]) {
      expect(ledger).toContain(`data-column="${column}"`);
    }
    expect(ledger).toContain("<caption");
    expect(ledger).toContain('role="region" aria-label={`${title} table`} tabIndex={0}');
    expect(ledger).toContain("<ResponsiveDetailPanel");
    expect(ledger).toContain('"Account ID": selected.userId');
    expect(ledger).toContain("...selected.fields");
    expect(source).toContain('"Period end": row.currentPeriodEnd?.toISOString() ?? "Not recorded"');
    expect(source).toContain("Cancellation: row.cancelAtPeriodEnd");
    expect(source).toContain("Value: JSON.stringify(row.valueJson, null, 2)");
  });

  it("keeps lifetime billing grants behind a confirmation", () => {
    const grant = readFileSync(
      join(process.cwd(), "src/app/admin/admin-lifetime-grant.tsx"),
      "utf8",
    );
    const operation = readFileSync(
      join(process.cwd(), "src/app/admin/admin-operation-form.tsx"),
      "utf8",
    );
    expect(source).toContain('actor.role === "owner"');
    expect(source).toContain("<AdminLifetimeGrant />");
    expect(grant).toContain("resolveAdminGrantTargetAction(data)");
    expect(grant).toContain("if (!result.ok || !result.target)");
    expect(grant).toContain('operation="grant-lifetime"');
    expect(grant).toContain("Create permanent full-plan entitlements");
    expect(grant).toContain('name="email" value={target.email}');
    expect(grant).toContain('name="userId" value={target.id}');
    expect(operation).toContain("const data = new FormData(e.currentTarget)");
    expect(operation).toContain("setReview(data)");
    expect(operation).toContain("Array.from(review.entries())");
    expect(operation).toContain("disabled={!ready || pending || review !== null}");
    expect(operation).toContain("onClick={() => setReview(null)}");
    expect(operation).toContain("if (busy.current) return");
    expect(operation).toContain("adminFormAction({ ok: false }, review)");
    expect(operation).toContain("`Confirm ${title.toLowerCase()}`");
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
