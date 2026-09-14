import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/billing/page.tsx"), "utf8");

describe("account plan page", () => {
  it("puts the current plan, status, renewal state and manage action first", () => {
    expect(source).toContain("Current plan");
    expect(source).toContain("planStatus(");
    expect(source).toContain("renewalState(");
    expect(source).toContain("<BillingManageDialog");
    expect(source).toContain("data-primary-action");
  });

  it("uses the shared public catalogue and keeps all purchasable tiers available", () => {
    expect(source).toContain("Compare plans");
    expect(source).toContain("!plan.internal");
    expect(source).toContain("plan.features.map");
    expect(source).toContain("data.checkoutAvailability[plan.key]");
    expect(source).not.toContain("Free or Full");
    expect(source).not.toContain('return "Full"');
  });

  it("keeps billing history compact and technical entitlements collapsed", () => {
    expect(source).toContain("<BillingHistory");
    expect(source).toContain("<details>");
    expect(source).toContain("Your access and usage limits");
    expect(source).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain("Plan limits ledger");
  });

  it("renders billing failures as alerts", () => {
    expect(source).toContain('variant={notice.error ? "destructive" : "default"}');
    expect(source).toContain("Payment needs attention");
    expect(source).toContain('<Alert variant="destructive">');
  });

  it("explains portal consequences and preserves recoverable portal opening", () => {
    const dialog = readFileSync(
      join(process.cwd(), "src/app/billing/billing-manage-dialog.tsx"),
      "utf8",
    );

    expect(source).not.toContain("<form action={openCustomerPortalAction}");
    expect(dialog).toContain("<ResponsiveDetailPanel");
    expect(dialog).toContain("openCustomerPortalFormAction");
    expect(dialog).toContain("if (busy.current) return");
    expect(dialog).toContain('role="alert"');
    expect(dialog).toContain("available plan changes and cancellation");
    expect(dialog).toContain("No subscription change is made here");
  });

  it("does not present billing as a desktop workbench or admin console", () => {
    expect(source).not.toContain("DesktopWorkbenchLayout");
    expect(source).not.toContain("DataTableFrame");
    expect(source).not.toContain("exportFileName");
    expect(source).not.toContain("billing console");
  });
});
