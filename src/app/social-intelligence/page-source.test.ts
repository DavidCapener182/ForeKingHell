import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/social-intelligence/page.tsx"),
  "utf8",
);

describe("social intelligence desktop safety console", () => {
  it("keeps the safety queue as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="social-safety"');
    expect(source).toContain('scope="social-safety"');
    expect(source).toContain('data-workbench-scope="social-safety"');
    expect(source).toContain('exportTableId="social-safety"');
    expect(source).toContain('data-workbench-export-table="social-safety"');
    expect(source).toContain('mainTableLabel="Social safety queue table"');
    expect(source).toContain('mainTableLabel="Social safety queue table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "source",
      "severity",
      "status",
      "reason",
      "target",
      "detail",
      "created",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("does not add the contextual AI rail to the social safety route", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("uses a conclusion-first mobile safety queue with forms in sheets", () => {
    expect(source).toContain("<MobileAppShell>");
    expect(source).toContain("MobileSocialSafetyQueue");
    expect(source).toContain("MobileSocialRecaps");
    expect(source).toContain("MobileSafetyTechnicalDetails");
    expect(source).toContain("SocialReportForm");
    expect(source).toContain("GenerateSummaryForm");
    expect(source).toContain("<BottomSheet");
    expect(source).toContain(
      '<DesktopWorkbenchLayout scope="social-intelligence" className="hidden lg:grid">',
    );
  });
});
