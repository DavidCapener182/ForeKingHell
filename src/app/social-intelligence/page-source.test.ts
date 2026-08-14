import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/social-intelligence/page.tsx"),
  "utf8",
);

describe("social intelligence desktop safety console", () => {
  it("ships only the safety workbench graph on this desktop-only route", () => {
    expect(source).toContain('<DesktopWorkbenchLayout scope="social-intelligence">');
    for (const obsolete of [
      "getRequestAppSurface",
      "MobileAppShell",
      "MobileSocialSafetyQueue",
      "MobileSocialRecaps",
      "MobileSafetyTechnicalDetails",
      "BottomSheet",
      "IOSDisclosureGroup",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });

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

  it("preserves the workbench report and summary actions", () => {
    expect(source).toContain("SocialReportForm");
    expect(source).toContain("GenerateSummaryForm");
  });

  it("uses the shared shadcn textarea for report details", () => {
    expect(source).toContain('import { Textarea } from "@/components/ui/textarea"');
    expect(source).toContain("<Textarea");
    expect(source).not.toMatch(/<textarea\b/);
  });

  it("uses theme-aware ordinary safety surfaces", () => {
    expect(source).toContain("bg-card");
    expect(source).toContain("<Card>");
    expect(source).toContain("<CardHeader");
    expect(source).toContain("<CardContent");
    expect(source).toContain('className="divide-y"');
    expect(source).toContain('className="grid min-w-0 gap-3"');
    expect(source).not.toContain("rounded-xl border bg-card p-4 shadow-sm");
    expect(source).not.toMatch(/\b(?:bg-white|bg-slate-\d+|text-slate-\d+|border-slate-\d+)\b/);
    expect(source).not.toMatch(/bg-\[#[0-9A-Fa-f]+\]|text-white|text-(?:emerald|red)-\d+/);
  });
});
