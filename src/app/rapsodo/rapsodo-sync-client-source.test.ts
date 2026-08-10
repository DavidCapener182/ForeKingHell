import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rapsodo/rapsodo-sync-client.tsx"), "utf8");

describe("rapsodo desktop provider console", () => {
  it("keeps the specialist import flow mobile-native through the lg breakpoint", () => {
    expect(source).toContain("IOSGroupedList");
    expect(source).toContain("MobileRapsodoSessionRows");
    expect(source).toContain("lg:hidden");
    expect(source).toContain("hidden lg:block");
    expect(source).not.toContain('className="hidden sm:block"');
    expect(source).not.toContain('className="sm:hidden"');
    expect(source).toContain(
      '<h2 className="mt-2 text-xl font-semibold leading-tight tracking-normal text-balance">',
    );
    expect(source).not.toContain(">\n            Rapsodo Inbox\n          </h1>");
  });

  it("uses the desktop workflow template for provider connection and import review", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain("rapsodoWorkflowHelpItems");
    expect(source).toContain("buildRapsodoWorkflowSteps");
    expect(source).toContain('helpTitle="Rapsodo sync help"');
    expect(source).toContain('helpDescription="Keep provider imports deterministic"');
    expect(source).toContain("Connect R-Cloud");
    expect(source).toContain("Load sessions");
    expect(source).toContain("Preview shots");
    expect(source).toContain("Map clubs");
    expect(source).toContain("Save import");
    expect(source).toContain("Review trust");
    expect(source).toContain("Token privacy");
    expect(source).toContain("Review before save");
    expect(source).toContain("Avoid duplicates");
    expect(source).not.toContain("DesktopWorkbenchLayout");
  });

  it("keeps remote sessions exportable and configurable without adding an AI rail", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="rapsodo-sessions"');
    expect(source).toContain('scope="rapsodo"');
    expect(source).toContain('exportTableId="rapsodo-sessions"');
    expect(source).toContain("DataTableFrame");
    expect(source).toContain('data-workbench-scope="rapsodo"');
    expect(source).toContain('data-workbench-export-table="rapsodo-sessions"');
    expect(source).toContain('mainTableLabel="Rapsodo remote sessions table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");
    expect(source).not.toContain("DesktopInsightRail");

    for (const column of ["session", "type", "date", "shots", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("defaults club mapping to recommendations and labels the saved choice accurately", () => {
    expect(source).toContain('useState<ClubSelectionMode>("recommendations")');
    expect(source).toContain('? "Recommended club"');
    expect(source).toContain('? "Recommended clubs"');
    expect(source).toContain('? "recommended"');
    expect(source).not.toContain("Confirmed club");
    expect(source).not.toContain("confirmed shots");
  });
});
