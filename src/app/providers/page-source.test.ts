import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/providers/page.tsx"), "utf8");

describe("providers desktop workbench", () => {
  it("keeps the desktop-only provider console free of an obsolete companion tree", () => {
    expect(source).not.toContain("MobileProviderConsole");
    expect(source).not.toContain("MobileProviderRows");
    expect(source).not.toContain("MobileProviderSessionRows");
    expect(source).not.toContain("IOSDisclosureGroup");
    expect(source).not.toContain("MobileAppShell");
    expect(source).not.toContain('className="hidden lg:grid"');
    expect(source).toContain('<DesktopWorkbenchLayout scope="providers">');
    expect(source).not.toContain("0 blocking failures");
    expect(source).toContain("No import jobs observed");
  });

  it("keeps provider sessions as an exportable desktop table", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="provider-sessions"');
    expect(source).toContain('scope="provider-sessions"');
    expect(source).toContain('data-workbench-scope="provider-sessions"');
    expect(source).toContain('exportTableId="provider-sessions"');
    expect(source).toContain('data-workbench-export-table="provider-sessions"');
    expect(source).toContain('mainTableLabel="Provider sessions table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "session",
      "provider",
      "session-date",
      "last-seen",
      "import-status",
      "provider-id",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("uses semantic theme tokens for the provider table and primary action", () => {
    expect(source).toContain("[&_th]:bg-muted");
    expect(source).toContain("min-w-56 bg-muted");
    expect(source).toContain("min-w-56 bg-card font-medium");
    expect(source).toContain('<Database className="size-4 text-primary"');

    for (const hardCodedToken of [
      "bg-white",
      "text-sky-",
      "text-amber-",
      "bg-[#",
      "text-[#",
      "border-[#",
    ]) {
      expect(source).not.toContain(hardCodedToken);
    }
  });

  it("shows provider health with operational adapter statuses", () => {
    expect(source).toContain("Rapsodo is live");
    expect(source).toContain("Square is beta");
    expect(source).toContain("TrackMan is tracked as a research adapter");
    expect(source).toContain("Provider import health");
    expect(source).toContain("Last sync");
    expect(source).toContain("Import failures");
    expect(source).toContain("live/current");
    expect(source).toContain("beta adapter");
    expect(source).toContain("research adapter");
    expect(source).toContain("View adapter access");
    expect(source).not.toContain("coming soon");
  });

  it("uses integration cards, action menus, confirmation and isolated diagnostics tabs", () => {
    expect(source).toContain("data-provider-workbench-tabs");
    expect(source).toContain('<TabsTrigger value="connections">');
    expect(source).toContain('<TabsTrigger value="diagnostics">');
    expect(source).toContain("ProviderConnectionActions");
    expect(source).toContain("ConnectedMetricBar");
    expect(source).toContain("OperationStepper");
    expect(source).toContain("StatusTimeline");
    expect(source).toContain("AppEmptyState");
    expect(source).toContain("defaultValue={activeTab}");
    expect(source).toContain('href: "/providers?tab=diagnostics#provider-jobs"');
  });

  it("does not add the contextual AI rail to the provider console", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
