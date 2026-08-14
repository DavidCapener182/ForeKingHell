import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const entry = readFileSync(join(root, "src/app/(app)/import/result/page.tsx"), "utf8");
const runtimeEntry = readFileSync(
  join(root, "src/app/(app)/companion-runtime/import/result/page.tsx"),
  "utf8",
);
const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
const companion = readFileSync(
  join(root, "src/app/(app)/import/result/result-companion-page.tsx"),
  "utf8",
);
const workbench = readFileSync(
  join(root, "src/app/(app)/import/result/result-workbench-page.tsx"),
  "utf8",
);

describe("surface-specific import result", () => {
  it("isolates the companion result in its own compiled route", () => {
    expect(proxy).toContain('pathname === "/import/result"');
    expect(proxy).toContain('return "/companion-runtime/import/result"');
    expect(runtimeEntry).toContain('from "../../../import/result/result-companion-page"');
    expect(entry).toContain('from "./result-workbench-page"');
    expect(runtimeEntry).not.toContain("result-workbench-page");
  });

  it("renders the golf answer and charts before collapsed audit detail", () => {
    expect(companion).toContain("data-session-verdict");
    expect(companion).toContain("ResultHero");
    expect(companion).toContain("ConnectedMetricBar");
    expect(companion).toContain("<ButtonGroup");
    expect(companion).toContain("<Item");
    expect(companion).toContain("data-plan-versus-actual");
    expect(companion).toContain('eyebrow="Import complete"');
    expect(companion).toContain("result.reviewHref");
    expect(companion).toContain("MobileShotPatternCharts");
    expect(companion).toContain("What improved");
    expect(companion).toContain("What still needs work");
    expect(companion).toContain("Build next plan");
    expect(companion).toContain("data-import-audit");
    expect(companion).toContain("<Collapsible");
    expect(companion).toContain("className={buttonVariants");
    expect(companion).not.toContain("<CollapsibleTrigger asChild>");
    expect(companion).toContain("<Table");
    expect(companion).toContain("Open Full Site shot audit");
    expect(companion).not.toContain("IOSGroupedList");
    expect(companion).not.toContain("IOSDisclosureGroup");
    expect(companion.match(/<ConnectedMetricBar/g)).toHaveLength(2);
    expect(companion.indexOf("MobileShotPatternCharts")).toBeLessThan(
      companion.indexOf("data-import-audit"),
    );
  });

  it("preserves the deterministic desktop workflow receipt", () => {
    expect(workbench).toContain("DesktopWorkflowLayout");
    expect(workbench).toContain("importResultWorkflowSteps");
    expect(workbench).toContain("importResultHelpItems");
    expect(workbench).toContain("<ResultHero");
    expect(workbench).toContain("<ConnectedMetricBar");
    expect(workbench).toContain("data-import-trust-checks");
    expect(workbench).toContain("data-import-practice-review");
    expect(workbench).toContain("data-import-practice-prescription");
    expect(workbench).toContain("<Item");
    expect(workbench).not.toContain("MobileImportResult");
    expect(workbench).not.toContain("MobileAppShell");
    expect(workbench).not.toContain("IOSGroupedList");
    expect(workbench).not.toContain("DataPanel");
    expect(workbench).not.toMatch(
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i,
    );
    expect(workbench).not.toContain("DesktopInsightRail");
  });
});
