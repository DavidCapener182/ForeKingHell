import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/speed/sessions/[sessionId]/page.tsx"),
  "utf8",
);

describe("speed session desktop swing log", () => {
  it("uses the shared desktop workbench shell without adding a contextual rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="speed-session">');
    expect(source).toContain("</DesktopWorkbenchLayout>");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps individual swings in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="speed-session-swing-log"');
    expect(source).toContain('data-workbench-scope="speed-session-swings"');
    expect(source).toContain('data-workbench-export-table="speed-session-swings"');
    expect(source).toContain('mainTableLabel="Speed session swing log table"');
    expect(source).toContain('mainTableLabel="Speed session swing log table" stickyFirstColumn');
    expect(source).toContain("tabIndex={0}");
  });

  it("keeps the speed session detail page focused on data and editing", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});

describe("speed session desktop-only bundle", () => {
  it("excludes the obsolete companion and iOS render graph", () => {
    expect(source).toContain('<DesktopWorkbenchLayout scope="speed-session">');
    expect(source).toContain('className="grid gap-3"');

    for (const obsoleteSurface of [
      "MobileSpeedSessionAnswer",
      "MobileSpeedSessionDisclosures",
      "MobileSwingEvidence",
      "MobileSpeedSessionEditForm",
      "@/components/app/ios-mobile",
      "lg:hidden",
      "sm:hidden",
      "hidden lg:contents",
      'className="hidden gap-3 sm:grid"',
    ]) {
      expect(source).not.toContain(obsoleteSurface);
    }
  });

  it("keeps ordinary session cards and table cells theme-aware", () => {
    expect(source).toContain("bg-card");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).not.toMatch(/\b(?:bg-white|text-slate-|border-slate-|bg-emerald-)/);
  });
});
