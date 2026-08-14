import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/shot-pattern/page.tsx"),
  "utf8",
);

describe("course shot-pattern desktop setup board", () => {
  it("ships the desktop setup graph without CSS-hidden companion branches", () => {
    expect(source).toContain('className="grid scroll-mt-28 gap-4"');
    expect(source).toContain("h-[100svh] min-h-[100svh]");
    expect(source).toContain("lg:h-[72vh] lg:min-h-[620px]");
    expect(source).toContain("motion-reduce:animate-none");
    expect(source).not.toContain('className="hidden lg:block"');
    expect(source).not.toContain('className="hidden scroll-mt-28 gap-4 lg:grid"');
    expect(source).not.toContain('className="hidden items-center justify-between gap-4 lg:flex"');
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain("IOSDisclosureGroup");
  });

  it("keeps mapped holes and club evidence in desktop tables", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="course-shot-pattern">');
    expect(source).toContain('id="shot-pattern-setup"');
    expect(source).toContain('data-workbench-scope="shot-pattern-holes"');
    expect(source).toContain('data-workbench-export-table="shot-pattern-holes"');
    expect(source).toContain('mainTableLabel="Shot pattern mapped holes table"');
    expect(source).toContain('mainTableLabel="Shot pattern mapped holes table" stickyFirstColumn');
    expect(source).toContain('data-workbench-scope="shot-pattern-clubs"');
    expect(source).toContain('data-workbench-export-table="shot-pattern-clubs"');
    expect(source).toContain('label="Shot pattern club evidence table" stickyFirstColumn');
    expect(source).toContain("Desktop review of mapped holes");
    expect(source).toContain("tabIndex={0}");
  });

  it("does not add the full AI workbench slab to the course overlay", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("uses theme-aware workbench chrome while preserving the specialist map palette", () => {
    const workbenchSource = source.slice(0, source.indexOf("function ShotPatternPageLoading"));

    expect(source).toContain("[&_th]:bg-card");
    expect(source).toContain("shadow-[1px_0_0_hsl(var(--border))]");
    expect(workbenchSource).not.toMatch(/\b(?:bg-white|text-slate-\d+)\b/);
    expect(source).toContain("bg-[#101827]");
  });
});
