import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/rounds/new/page.tsx"), "utf8");

describe("new round desktop workflow", () => {
  it("uses the desktop wizard template for scorecard entry", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain("roundWorkflowSteps");
    expect(source).toContain("roundWorkflowHelpItems");
    expect(source).toContain('helpTitle="Round entry help"');
    expect(source).toContain('helpDescription="Keep the scorecard reliable"');

    for (const label of [
      "Pick course and tee",
      "Enter hole scores",
      "Add conditions",
      "Save and review",
    ]) {
      expect(source).toContain(label);
    }

    expect(source).toContain("keyboard-friendly on desktop");
    expect(source).toContain("review the scorecard");
  });

  it("starts the phone composition with the scorecard task and isolates the desktop hero", () => {
    expect(source).toContain("getRequestAppSurface");
    expect(source).toContain('surface === "workbench"');
    expect(source).toContain('await import("@/components/app/desktop-workbench")');
    expect(source).toContain('surface === "companion"');
    expect(source).toContain("MobileAppShell");
    expect(source).toContain('<MobileTopBar title="Add Round"');
    expect(source).toContain('instanceId="mobile-round"');
    expect(source).toContain("data-new-round-desktop-workflow");
    expect(source).toContain('className="grid gap-4"');
    expect(source).not.toContain('className="hidden gap-4 lg:grid"');
    expect(source).toContain('instanceId="desktop-round"');
    expect(source).not.toContain("MobileRouteHeader");
  });
});
