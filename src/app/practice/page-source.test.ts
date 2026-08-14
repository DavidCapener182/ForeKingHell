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
    expect(companionSource).toContain("data-plan-versus-actual");
    expect(companionSource).toContain("data-practice-finished");
    expect(companionSource).toContain("<FieldGroup");
    expect(companionSource).toContain("<FieldSet");
    expect(companionSource).toContain("<ButtonGroup");
    expect(companionSource).toContain("<Carousel");
    expect(companionSource).toContain("data-practice-block-carousel");
    expect(companionSource).toContain("w-full min-w-0 max-w-full overflow-hidden");
    expect(companionSource).toContain('label="Volume"');
    expect(companionSource).not.toContain("w-40 shrink-0 snap-start");
    expect(companionSource).not.toContain("DesktopTableWorkbenchControls");
    expect(companionSource).not.toContain("PracticeLibrary");
  });

  it("keeps the workbench route separate from the companion mobile surface", () => {
    expect(source).toContain("<PracticePlannerClient");
    expect(source).not.toContain("accountId={userId}");
    expect(source).not.toContain("<PracticeSessionCockpit");
    expect(source).not.toContain("<MobileRouteHeader");
    expect(source).not.toContain("IOSGroupedList");
    expect(source).not.toContain("IOSDisclosureGroup");
    expect(source).not.toContain("IOSListRow");
    expect(source).not.toContain("IOSMetricRow");
    expect(source).not.toContain("StickyMobileAction");
    expect(source).toContain("data-practice-workbench-header");
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
    expect(source).not.toContain("<OperationStepper");
    expect(source).not.toContain('label="Practice workflow progress"');
    const workbenchHeader =
      source.match(
        /<Card className="hidden shadow-sm lg:block"[\s\S]*?<PracticePlannerClient/,
      )?.[0] ?? "";
    expect(workbenchHeader).toContain("<Badge");
    expect(workbenchHeader).toContain("<ConnectedMetricBar");
    expect(workbenchHeader).not.toContain("<StatusPill");
  });

  it("keeps practice scoring tied to imported launch-monitor rows", () => {
    expect(source).toContain(
      "Practice completion and block scores come from matched launch-monitor rows",
    );
    expect(source).toContain("Compare planned blocks against imported shot rows");
    expect(source).toContain("hasSessionEvidence");
  });

  it("keeps the ordinary workbench shell on semantic theme tokens", () => {
    expect(source).not.toMatch(
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i,
    );
    expect(source).toContain("<Card");
    expect(source).toContain("text-muted-foreground");
  });
});
