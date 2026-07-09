import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/desktop-workbench.tsx"),
  "utf8",
);

describe("desktop workbench workflow layout", () => {
  it("keeps rails opt-in and excludes dense dashboard workspaces", () => {
    expect(source).toContain('type DesktopRailBreakpoint = "xl" | "2xl" | "wide"');
    expect(source).toContain('railBreakpoint = "wide"');
    expect(source).toContain("railBreakpoint?: DesktopRailBreakpoint");
    const railScopeBlock =
      source.match(/const desktopInsightRailScopes = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? "";
    expect(railScopeBlock).not.toContain('"dashboard"');
    for (const scope of ["today", "progress", "shots", "bag", "coach", "data-chat", "admin"]) {
      expect(railScopeBlock).toContain(`"${scope}"`);
    }
    expect(source).toContain(
      "min-[2200px]:grid-cols-[minmax(0,1fr)_22rem] min-[2200px]:items-start",
    );
    expect(source).toContain('"hidden min-[2200px]:block"');
    expect(source).toContain("2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:items-start");
    expect(source).toContain("xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start");
    expect(source).toContain('railBreakpoint === "wide"');
    expect(source).toContain('railBreakpoint === "2xl"');
    expect(source).toContain('"hidden 2xl:block"');
  });

  it("keeps the reusable wizard template as step rail, main workspace and help rail", () => {
    expect(source).toContain("export function DesktopWorkflowLayout");
    expect(source).toContain('workflowRailBreakpoint = "lg"');
    expect(source).toContain('workflowRailBreakpoint?: "lg" | "2xl"');
    expect(source).toContain("data-desktop-workflow");
    expect(source).toContain("lg:grid-cols-[minmax(0,1fr)]");
    expect(source).toContain("lg:grid-cols-[17rem_minmax(0,1fr)]");
    expect(source).toContain("2xl:grid-cols-[17rem_minmax(0,1fr)_20rem]");
    expect(source).toContain('SectionHeader title="Workflow"');
    expect(source).toContain("[&>*]:min-w-0");
    expect(source).toContain('workflowRailBreakpoint === "2xl" ? "2xl:grid" : "lg:grid"');
    expect(source).toContain("hidden min-w-0 2xl:grid");
    expect(source).toContain("helpTitle");
    expect(source).toContain("helpDescription");
    expect(source).toContain("helpItems.map");
  });

  it("puts a real save-insight control in the shared AI rail action stack", () => {
    expect(source).toContain(
      'import { DesktopSaveInsightButton } from "@/components/app/desktop-save-insight-button";',
    );
    expect(source).toContain('prompt.label === "Save this insight"');
    expect(source).toContain('prompt.label !== "Save this insight"');
    expect(source).toContain("<DesktopSaveInsightButton");
    expect(source).toContain('group="AI insight"');
    expect(source).toContain(
      "{reportPrompts.length ? <AiPromptList prompts={reportPrompts} /> : null}",
    );
  });
});
