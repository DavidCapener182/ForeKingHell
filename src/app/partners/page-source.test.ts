import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/partners/page.tsx"), "utf8");

const register = readFileSync(join(process.cwd(), "src/app/partners/partner-register.tsx"), "utf8");

describe("partners desktop operations board", () => {
  it("ships only the workbench graph on this desktop-only route", () => {
    expect(source).toContain('<DesktopWorkbenchLayout scope="partners">');
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

  it("uses the partners artwork variant on the actual operations page", () => {
    expect(source).toContain('variant="partners"');
    expect(source).toContain("visual={<PageArtwork");
  });

  it("summarises campaign, asset and plan requirements from existing partner data", () => {
    expect(source).toContain("PartnerOperationsSummary");
    expect(source).toContain("activeContextualOffers");
    expect(source).toContain("sponsorAssetCount");
    expect(source).toContain("Campaign, asset and plan requirements");
    expect(source).toContain("Plan requirements");
    expect(source).toContain("Owner + label");
    expect(source).toContain("Recent clicks");
  });

  it("keeps the extracted sponsor pipeline exportable and configurable", () => {
    expect(source).toContain("<PartnerRegister");
    expect(source).toContain("rows={data.sponsors.map");
    expect(register).toContain("<table");
    expect(register).toContain("<caption");
    expect(register).toContain('scope="col"');
    expect(register).toContain('scope="row"');
    expect(register).toContain("DesktopTableWorkbenchControls");
    expect(register).toContain('viewKey="partner-sponsors"');
    expect(register).toContain('exportTableId="partner-sponsors"');
    for (const column of ["sponsor", "status", "owner", "contact", "created", "updated"]) {
      expect(register).toContain(`data-column="${column}"`);
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
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-muted/40");
  });
});
