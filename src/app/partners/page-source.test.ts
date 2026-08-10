import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/partners/page.tsx"), "utf8");

describe("partners desktop operations board", () => {
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

  it("keeps the sponsor pipeline as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="partner-sponsors"');
    expect(source).toContain('scope="partner-sponsors"');
    expect(source).toContain('data-workbench-scope="partner-sponsors"');
    expect(source).toContain('exportTableId="partner-sponsors"');
    expect(source).toContain('data-workbench-export-table="partner-sponsors"');
    expect(source).toContain('mainTableLabel="Sponsor pipeline table"');
    expect(source).toContain('mainTableLabel="Sponsor pipeline table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["sponsor", "status", "owner", "contact", "created", "updated"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps partners as a platform console without a contextual AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("uses native mobile sponsor and offer lists with focused creation sheets", () => {
    expect(source).toContain("MobilePartnersOperations");
    expect(source).toContain("MobilePartnerOfferRows");
    expect(source).toContain("MobileSponsorRows");
    expect(source).toContain("<BottomSheet");
    expect(source).toContain("IOSDisclosureGroup");
    expect(source).toContain(
      '<DesktopWorkbenchLayout scope="partners" className="hidden lg:grid">',
    );
  });
});
