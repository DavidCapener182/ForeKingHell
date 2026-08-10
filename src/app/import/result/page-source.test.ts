import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/import/result/page.tsx"), "utf8");

describe("import result desktop workflow receipt", () => {
  it("renders an answer-first mobile receipt without duplicating the desktop workflow", () => {
    expect(source).toContain("MobileImportResult");
    expect(source).toContain("MobileAppShell");
    expect(source).toContain("MobileStatusAction");
    expect(source).toContain("IOSDisclosureGroup");
    expect(source).toContain('className="hidden lg:grid"');
  });

  it("uses the shared desktop workflow layout for post-import review", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain("steps={workflowSteps}");
    expect(source).toContain('helpTitle="Import audit"');
    expect(source).toContain('helpDescription="Receipt checks for the saved session"');
    expect(source).toContain("helpItems={helpItems}");
    expect(source).toContain("importResultWorkflowSteps");
    expect(source).toContain("importResultHelpItems");
    expect(source).toContain("CSV saved");
    expect(source).toContain("Quality check");
    expect(source).toContain("Session review");
    expect(source).toContain("Practice decision");
  });

  it("keeps the import receipt deterministic and out of the contextual AI rail pattern", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
