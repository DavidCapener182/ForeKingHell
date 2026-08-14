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

  it("uses a compact Free and Full comparison instead of marketing cards", () => {
    expect(source).toContain("Free or Full");
    expect(source).toContain("fullPlanComparison.map");
    expect(source).toContain('<PlanColumnHeading label="Free"');
    expect(source).toContain('<PlanColumnHeading label="Full"');
    expect(source).not.toContain("function PlanCard(");
    expect(source).not.toContain("Upgrade prompts");
    expect(source).not.toContain("PageArtwork");
  });

  it("keeps billing history compact and technical entitlements collapsed", () => {
    expect(source).toContain("<BillingHistoryTable");
    expect(source).toContain('<Accordion type="single" collapsible>');
    expect(source).toContain('value="technical-details"');
    expect(source).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain("Plan limits ledger");
  });

  it("renders billing failures as alerts", () => {
    expect(source).toContain('variant={notice.error ? "destructive" : "default"}');
    expect(source).toContain("Payment needs attention");
    expect(source).toContain('<Alert variant="destructive">');
  });

  it("routes cancellation and downgrade management through an AlertDialog", () => {
    const dialog = readFileSync(
      join(process.cwd(), "src/app/billing/billing-manage-dialog.tsx"),
      "utf8",
    );

    expect(source).not.toContain("<form action={openCustomerPortalAction}");
    expect(dialog).toContain("<AlertDialog>");
    expect(dialog).toContain("downgrade, or cancel at the end");
    expect(dialog).toContain("No plan changes happen until you confirm them there");
  });

  it("does not present billing as a desktop workbench or admin console", () => {
    expect(source).not.toContain("DesktopWorkbenchLayout");
    expect(source).not.toContain("DataTableFrame");
    expect(source).not.toContain("exportFileName");
    expect(source).not.toContain("billing console");
  });
});
