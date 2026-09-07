import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/bag/longest/page.tsx"), "utf8");
const dataSource = readFileSync(join(process.cwd(), "src/lib/longest-shot-data.ts"), "utf8");

describe("longest shot desktop PB board", () => {
  it("is directly discoverable from Bag before its analytical tabs", () => {
    const bag = readFileSync(join(process.cwd(), "src/app/(app)/bag/page.tsx"), "utf8");
    const entry = readFileSync(
      join(process.cwd(), "src/components/app/best-shots-entry.tsx"),
      "utf8",
    );
    expect(bag.indexOf("<BestShotsEntry")).toBeGreaterThan(-1);
    expect(bag.indexOf("<BestShotsEntry")).toBeLessThan(bag.indexOf("<UrlTabs"));
    expect(entry).toContain('href="/bag/longest"');
    expect(entry).toContain("Best shots by club");
    expect(entry).toContain("Your longest carry. Your longest total.");
  });
  it("leads with the responsive record board and keeps replay optional", () => {
    expect(source).toContain("<BestShotsBoard");
    expect(source.indexOf("<BestShotsBoard")).toBeLessThan(source.indexOf("<LongestShotsSection"));
    expect(source).toContain("Explore the illustrative shot replay");

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

  it("keeps the raw maximum separate while lifecycle-gating trusted PB evidence", () => {
    const loader =
      dataSource.match(/async function getLongestShots[\s\S]*?type LongestShotRow/)?.[0] ?? "";

    expect(loader).toContain("rawRecordRows");
    expect(loader).toContain("trustedRecordRows");
    expect(loader).toContain('eq(shots.reviewStatus, "restored")');
    expect(loader).toContain('eq(shots.reviewStatus, "included")');
    expect(loader).toContain("trustedLifecycleEvidence");
    expect(loader).toContain('"warm_up"');
  });
});
