import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/settings/page.tsx"), "utf8");

describe("settings desktop account access", () => {
  it("uses the settings artwork variant in the desktop platform header", () => {
    expect(source).toContain('variant="settings"');
    expect(source).toContain("visual={<PageArtwork");
    expect(source).toContain("min-h-36");
  });

  it("keeps account access as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="settings-access"');
    expect(source).toContain('scope="settings-access"');
    expect(source).toContain('data-workbench-scope="settings-access"');
    expect(source).toContain('exportTableId="settings-access"');
    expect(source).toContain('data-workbench-export-table="settings-access"');
    expect(source).toContain('mainTableLabel="Account access table"');
    expect(source).toContain('mainTableLabel="Account access table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["scope", "party", "role", "status", "detail", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps settings as a platform console without a contextual AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
