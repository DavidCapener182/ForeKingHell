import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rapsodo/rapsodo-sync-client.tsx"), "utf8");
const companion = readFileSync(
  join(process.cwd(), "src/app/rapsodo/rapsodo-companion-client.tsx"),
  "utf8",
);
const companionPreview = readFileSync(
  join(process.cwd(), "src/app/rapsodo/rapsodo-companion-preview.tsx"),
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
    expect(companionPreview).toContain("Session preview");
    expect(companionPreview).toContain("Review shots");
    expect(companionPreview).toContain("practicePlanId");
    expect(companionPreview).toContain("companionRapsodoResultHref");
    expect(companion).toContain("<ScrollArea");
    expect(companion).toContain(
      "<Button\n                key={`${session.providerKind}-${session.providerSessionId}`}",
    );
    expect(companion).toContain("<Item");
    expect(companion).toContain("onClick={() => openPreview(session)}");
    expect(companion).not.toMatch(/<button\b/);
    expect(companionPreview).toContain("<Drawer");
    expect(companionPreview).toContain("<Item");
    expect(companionPreview).not.toContain("<Table");
    expect(companionPreview).toContain("<Field");
    expect(companionPreview).toContain("<OperationStepper");
    expect(companionPreview).toContain("<ConnectedMetricBar");
    expect(companionPreview).toContain("data-rapsodo-preview-summary");
    expect(companionPreview).toContain("data-rapsodo-shot-review");
    expect(companionPreview).toContain("Review every shot");
    expect(companionPreview).toContain("excludedShotRowNumbers");
    expect(companionPreview).toContain('"Restore" : "Remove"');
    expect(companionPreview).toContain("Restore");
    expect(companion).toContain("<DropdownMenu");
    expect(companion).toContain("<AlertDialog");
    expect(companion).toContain("Use a CSV instead");
    expect(companionWorkflow).toContain("/import/result?sessionId=");
    expect(companion).not.toContain('href="/shots"');
    expect(companion).not.toContain("DesktopWorkflowLayout");
    expect(companion).not.toContain("IOSGroupedList");
    expect(companion).not.toContain("IOSMetricRow");
    expect(companion).not.toContain("IOSSectionHeader");
  });

  it("loads preview and mapping controls only after a session is opened", () => {
    expect(companion).toContain('import dynamic from "next/dynamic"');
    expect(companion).toContain('import("@/app/rapsodo/rapsodo-companion-preview")');
    expect(companion).toContain("preview={preview}");
    expect(companion).not.toContain('from "@/components/ui/drawer"');
    expect(companion).not.toContain('from "@/components/ui/select"');
    expect(companion).not.toContain('from "@/components/ui/table"');
    expect(companionPreview).toContain("importRapsodoSessionAction");
    expect(companionPreview).toContain("uncertainCompanionRapsodoShots");
  });

  it("keeps the mocked provider fixture behind the non-production Playwright auth guard", () => {
    expect(e2eFixture).toContain("isPlaywrightE2eAuthBypassEnabled()");
    expect(e2eFixture).toContain('process.env.RAPSODO_E2E_FIXTURE === "1"');
    expect(currentUserSource).toContain('if (process.env.NODE_ENV === "production")');
    expect(currentUserSource).toContain("return false;");
  });
  it("keeps RapsodoSyncClient workbench-only after the companion runtime split", () => {
    expect(source).toContain("DesktopWorkflowLayout");
    expect(source).toContain('data-workbench-scope="rapsodo"');
    expect(source).not.toContain("IOSGroupedList");
    expect(source).not.toContain("IOSListRow");
    expect(source).not.toContain("MobileRapsodoSessionRows");
    expect(source).not.toContain("RapsodoInboxPrimaryCard");
    expect(source).not.toContain("RapsodoMobileStepper");
    expect(source).not.toContain("MobileAccordionSection");
    expect(source).not.toContain("MobileBentoSummary");
    expect(source).not.toContain("MobileDataCard");
    expect(source).not.toContain("StickyMobileAction");
    expect(source).not.toContain("MobileRouteHeader");
    expect(source).not.toContain("CompactSummaryTile");
    expect(source).not.toContain("data-mobile-preserve-dark");
    expect(source).not.toContain("premium-hero");
    expect(source).not.toContain("mobileStep");
    expect(source).not.toContain("lg:hidden");
    expect(source).not.toContain("hidden lg:");
    expect(source).not.toMatch(/<button\b/);
    expect(companion).toContain("RapsodoCompanionClient");
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

  it("flattens disconnected benefit tiles into Items instead of nested Cards", () => {
    expect(source).toContain("data-rapsodo-connect-benefits");
    expect(source).toContain('<Item key={item.title} variant="muted" size="sm"');
    expect(source).toContain("<ItemMedia>");
    expect(source).toContain("<ItemContent>");
    expect(source).not.toContain('<Card key={item.title} className="p-3 shadow-none">');
  });

  it("uses the shadcn Textarea for scorecard rows instead of a raw textarea", () => {
    expect(source).toContain('import { Textarea } from "@/components/ui/textarea"');
    expect(source).toContain("<Textarea");
    expect(source).toContain('placeholder="Hole, par, yards"');
    expect(source).not.toMatch(/<textarea\b/);
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
    expect(source).toContain('? "recommended"');
    expect(source).not.toContain("Confirmed club");
    expect(source).not.toContain("confirmed shots");
  });
});
