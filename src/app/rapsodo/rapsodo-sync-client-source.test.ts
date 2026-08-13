import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rapsodo/rapsodo-sync-client.tsx"), "utf8");
const companion = readFileSync(
  join(process.cwd(), "src/app/rapsodo/rapsodo-companion-client.tsx"),
  "utf8",
);
const companionWorkflow = readFileSync(
  join(process.cwd(), "src/lib/rapsodo/companion-workflow.ts"),
  "utf8",
);
const e2eFixture = readFileSync(join(process.cwd(), "src/lib/rapsodo/e2e-fixture.ts"), "utf8");
const currentUserSource = readFileSync(join(process.cwd(), "src/lib/current-user.ts"), "utf8");
const workbenchEntry = readFileSync(join(process.cwd(), "src/app/(app)/rapsodo/page.tsx"), "utf8");
const runtimeEntry = readFileSync(
  join(process.cwd(), "src/app/(app)/companion-runtime/rapsodo/page.tsx"),
  "utf8",
);
const proxySource = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");

describe("rapsodo desktop provider console", () => {
  it("compiles companion and workbench clients on isolated rewritten routes", () => {
    expect(proxySource).toContain('pathname === "/rapsodo"');
    expect(proxySource).toContain('return "/companion-runtime/rapsodo"');
    expect(runtimeEntry).toContain("RapsodoCompanionClient");
    expect(runtimeEntry).not.toContain("RapsodoSyncClient");
    expect(workbenchEntry).toContain("rapsodo-workbench-page");
    expect(workbenchEntry).not.toContain("RapsodoCompanionClient");
  });

  it("keeps the phone journey to recent unimported sessions and the common review", () => {
    expect(companion).toContain("loadSessions");
    expect(companion).toContain("companionRapsodoInbox");
    expect(companionWorkflow).toContain("!session.importedSessionId");
    expect(companion).toContain("Session preview");
    expect(companion).toContain("Confirm uncertain clubs");
    expect(companion).toContain("practicePlanId");
    expect(companion).toContain("companionRapsodoResultHref");
    expect(companionWorkflow).toContain("/import/result?sessionId=");
    expect(companion).not.toContain('href="/shots"');
    expect(companion).not.toContain("DesktopWorkflowLayout");
  });

  it("keeps the mocked provider fixture behind the non-production Playwright auth guard", () => {
    expect(e2eFixture).toContain("isPlaywrightE2eAuthBypassEnabled()");
    expect(e2eFixture).toContain('process.env.RAPSODO_E2E_FIXTURE === "1"');
    expect(currentUserSource).toContain('if (process.env.NODE_ENV === "production")');
    expect(currentUserSource).toContain("return false;");
  });
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

  it("uses shadcn connection actions, responsive preview and disconnect confirmation", () => {
    expect(source).toContain("data-rapsodo-connection-card");
    expect(source).toContain("ConnectedMetricBar");
    expect(source).toContain("DropdownMenu");
    expect(source).toContain("ResponsiveDetailPanel");
    expect(source).toContain("AlertDialog");
    expect(source).toContain("disconnectConfirmationOpen");
    expect(source).toContain("<Select");
    expect(source).not.toContain("<select");
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
