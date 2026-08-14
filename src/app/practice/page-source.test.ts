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
const plannerSource = readFileSync(
  join(process.cwd(), "src/app/practice/practice-planner-client.tsx"),
  "utf8",
);
const plannerWorkspaceSource = plannerSource.slice(
  0,
  plannerSource.indexOf("function practicePlanImageDataUrl"),
);

describe("practice planner desktop workflow", () => {
  it("branches before importing the companion or workbench implementation", () => {
    expect(routeSource).toContain('surface === "companion"');
    expect(routeSource).toContain('await import("./practice-companion-page")');
    expect(routeSource).toContain('await import("./practice-workbench-page")');
    expect(companionSource).toContain("Save & Start Practice");
    expect(companionSource).toContain("data-active-range-mode");
    expect(companionSource).toContain("OperationStepper");
    expect(companionSource).toContain('id: "brief"');
    expect(companionSource).toContain('id: "plan"');
    expect(companionSource).toContain('id: "start"');
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
    expect(companionSource).toContain("Balls remaining");
    expect(companionSource).toContain("Success target");
    expect(companionSource).toContain("Next action");
    expect(companionSource).toContain("Previous");
    expect(companionSource).toContain("Complete");
    expect(companionSource).toContain("Quick adjustments");
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
    expect(source).toContain('<PageShell size="full"');
    expect(source).toContain("<PracticePlannerClient");
  });

  it("uses the five-step workflow without adding a contextual AI rail", () => {
    expect(plannerSource).toContain("<OperationStepper");
    expect(plannerSource).toContain('label="Practice workflow"');
    for (const step of ["Brief", "Plan", "Start", "Evidence", "Review"]) {
      expect(plannerSource).toContain(`label: "${step}"`);
    }
    expect(plannerSource).not.toContain("DesktopInsightRail");
    expect(plannerSource).not.toContain("commonAiPrompts");
    expect(source).not.toContain("DesktopWorkflowLayout");
  });

  it("keeps practice scoring tied to imported launch-monitor rows", () => {
    expect(plannerSource).toMatch(
      /Only imported launch-monitor rows can pass,\s+partially pass, or\s+fail a block\./,
    );
    expect(plannerSource).toContain("Every result is calculated from its launch-monitor rows.");
    expect(plannerSource).toContain("linkPracticePlanSessionAction");
  });

  it("keeps the ordinary workbench shell on semantic theme tokens", () => {
    expect(plannerWorkspaceSource).not.toMatch(
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i,
    );
    expect(plannerSource).toContain("<Card");
    expect(plannerSource).toContain("text-muted-foreground");
  });
});
