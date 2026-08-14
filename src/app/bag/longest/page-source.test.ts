import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/bag/longest/page.tsx"), "utf8");

describe("longest shot desktop PB board", () => {
  it("ships only the desktop PB board for this desktop-only route", () => {
    expect(source).toContain('className="grid gap-3"');

    for (const obsoleteSurface of [
      "MobileLongestShotEvidence",
      "@/components/app/ios-mobile",
      "data-mobile-longest-evidence",
      "lg:hidden",
      'className="hidden gap-3 lg:grid"',
    ]) {
      expect(source).not.toContain(obsoleteSurface);
    }
  });

  it("keeps ordinary PB surfaces theme-aware", () => {
    expect(source).toContain("bg-card");
    expect(source).not.toMatch(/\b(?:bg-white|text-slate-|border-slate-)/);
  });

  it("uses the shared desktop workbench shell without a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="longest-shots-route">');
    expect(source).toContain("</DesktopWorkbenchLayout>");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps the PB gallery backed by a desktop evidence table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="longest-shot-pb-table"');
    expect(source).toContain('data-workbench-scope="longest-shots"');
    expect(source).toContain('data-workbench-export-table="longest-shot-pbs"');
    expect(source).toContain('mainTableLabel="Longest shot PB evidence table"');
    expect(source).toContain('mainTableLabel="Longest shot PB evidence table" stickyFirstColumn');
    expect(source).toContain("PB evidence board");
    expect(source).toContain("tabIndex={0}");
  });

  it("keeps AI and insight rails out of the PB simulator route", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
