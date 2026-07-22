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
});
