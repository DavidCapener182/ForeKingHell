import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/practice/page.tsx"), "utf8");

describe("practice planner desktop workflow", () => {
  it("uses the workflow layout without adding a contextual AI rail", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain('workflowRailBreakpoint="2xl"');
    expect(source).toContain("practiceWorkflowHelpItems");
    expect(source).toContain("buildPracticeWorkflowSteps");
    expect(source).toContain('helpTitle="Practice workflow help"');
    expect(source).toContain("Score from shot evidence");
    expect(source).toContain('variant="practice"');
    expect(source).toContain('sizes="160px"');
    expect(source).toContain("min-[1800px]:block");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("commonAiPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps practice scoring tied to imported launch-monitor rows", () => {
    expect(source).toContain(
      "Practice completion and block scores come from matched launch-monitor rows",
    );
    expect(source).toContain("Compare planned blocks against imported shot rows");
    expect(source).toContain("hasSessionEvidence");
  });
});
