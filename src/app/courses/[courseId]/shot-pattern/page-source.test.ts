import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/shot-pattern/page.tsx"),
  "utf8",
);

describe("course shot-pattern desktop setup board", () => {
  it("keeps the specialist map full-screen below lg and moves desktop setup to lg", () => {
    expect(source).toContain('className="hidden lg:block"');
    expect(source).toContain('className="hidden scroll-mt-28 gap-4 lg:grid"');
    expect(source).toContain("h-[100svh] min-h-[100svh]");
    expect(source).toContain("lg:h-[72vh] lg:min-h-[620px]");
    expect(source).toContain("motion-reduce:animate-none");
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
});
