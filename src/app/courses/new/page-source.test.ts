import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/courses/new/page.tsx"), "utf8");

describe("new course desktop workflow", () => {
  it("uses the desktop wizard template for course setup and source review", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain("courseWorkflowSteps");
    expect(source).toContain("courseWorkflowHelpItems");
    expect(source).toContain('helpTitle="Course setup help"');
    expect(source).toContain('helpDescription="Build trustworthy course data"');

    for (const label of ["Choose source", "Confirm tee set", "Check duplicates", "Map holes"]) {
      expect(source).toContain(label);
    }

    expect(source).toContain("Google gives identity and media");
    expect(source).toContain("Keep low-confidence geometry visible");
    expect(source).toContain("hole-management workspace");
  });
});
