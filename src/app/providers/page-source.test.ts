import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/providers/page.tsx"), "utf8");

describe("providers desktop workbench", () => {
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

  it("does not add the contextual AI rail to the provider console", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
