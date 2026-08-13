import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/practice/practice-workbench-page.tsx"),
  "utf8",
);
const routeSource = readFileSync(join(process.cwd(), "src/app/(app)/practice/page.tsx"), "utf8");
const companionSource = readFileSync(
  join(process.cwd(), "src/app/practice/practice-companion-client.tsx"),
  "utf8",
);

describe("practice planner desktop workflow", () => {
  it("branches before importing the companion or workbench implementation", () => {
    expect(routeSource).toContain('surface === "companion"');
    expect(routeSource).toContain('await import("./practice-companion-page")');
    expect(routeSource).toContain('await import("./practice-workbench-page")');
    expect(companionSource).toContain("Save & Start Practice");
    expect(companionSource).toContain("data-active-range-mode");
    expect(companionSource).toContain("OperationStepper");
    expect(companionSource).toContain('id: "plan"');
    expect(companionSource).toContain('id: "range"');
    expect(companionSource).toContain('id: "evidence"');
    expect(companionSource).toContain('id: "review"');
    expect(companionSource).toContain("<Progress");
    expect(companionSource).toContain("<Drawer");
    expect(companionSource).toContain("<AlertDialog");
    expect(companionSource).toContain("Finish without evidence");
    expect(companionSource).toContain("w-40 shrink-0 snap-start");
    expect(companionSource).not.toContain("DesktopTableWorkbenchControls");
    expect(companionSource).not.toContain("PracticeLibrary");
  });

  it("puts the active mobile drill before historical session evidence", () => {
    expect(source).toContain("<PracticePlannerClient");
    expect(source).toContain("<PracticeSessionCockpit");
    expect(source.indexOf("<PracticePlannerClient")).toBeLessThan(
      source.indexOf("<PracticeSessionCockpit"),
    );
    expect(source).toContain('label="Latest practice evidence"');
    expect(source).not.toContain("StickyMobileAction");
    expect(source).toContain("hidden rounded-xl border border-border");
  });

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
