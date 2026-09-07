import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/partners/page.tsx"), "utf8");

const register = readFileSync(join(process.cwd(), "src/app/partners/partner-register.tsx"), "utf8");

describe("partners desktop operations board", () => {
  it("ships only the workbench graph on this desktop-only route", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    for (const obsolete of [
      "getRequestAppSurface",
      "MobilePartnersOperations",
      "MobilePartnerOfferRows",
      "MobileSponsorRows",
      "BottomSheet",
      "IOSDisclosureGroup",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });

  it("leads with the operational task and available owned sponsors", () => {
    expect(source).toContain('title="Sponsors and partner offers"');
    expect(source).toContain("<PartnerCreationForms");
    expect(source).toContain("sponsors={data.ownedSponsors.map");
  });

  it("reports loaded scope and avoids fabricating campaign readiness", () => {
    expect(source).toContain("data.ownedSponsors.length");
    expect(source).toContain("data.offers.length");
    expect(source).toContain("data.recentClicks.length");
    expect(register).toContain("campaign milestones are not configured");
    expect(source).toContain(
      'offer.offerType === "affiliate" ? "Affiliate offer" : "Sponsored offer"',
    );
    expect(source).toContain("offer.description");
    expect(source).toContain("offer.targetContext");
    expect(source).toContain("offer.couponCode");
    expect(source).toContain('name="offerId" value={offer.id}');
  });

  it("keeps the extracted sponsor pipeline exportable and configurable", () => {
    expect(source).toContain("<PartnerRegister");
    expect(source).toContain("rows={data.sponsors.map");
    expect(register).toContain("<table");
    expect(register).toContain("<caption");
    expect(register).toContain('scope="col"');
    expect(register).toContain('scope="row"');
    expect(register).toContain("DesktopWorkbenchControls");
    expect(register).toContain("viewKey={`partner-register:${currentUserId}`} ".trim());
    expect(register).toContain('data-workbench-export-table="partner-register"');
    expect(register).toContain("tabIndex={0}");
    expect(register).toContain("localView={{");
    for (const column of [
      "name",
      "id",
      "slug",
      "status",
      "ownerUserId",
      "contactEmail",
      "websiteUrl",
      "createdAt",
      "updatedAt",
      "offers",
    ]) {
      expect(register).toContain(`id: "${column}"`);
    }
  });

  it("keeps partners as a platform console without a contextual AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("uses theme-aware ordinary workbench surfaces", () => {
    expect(source).not.toMatch(/\b(?:bg-white|bg-slate-\d+|text-slate-\d+|border-slate-\d+)\b/);
    expect(source).not.toMatch(/bg-\[#[0-9A-Fa-f]+\]|text-white/);
    expect(source).toContain("text-muted-foreground");
    expect(source).toContain("rounded-xl border");
  });
});
