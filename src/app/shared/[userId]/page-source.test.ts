import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/shared/[userId]/page.tsx"), "utf8");

describe("shared account desktop workspace source", () => {
  it("keeps shared account review inside the desktop workbench shell", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('scope="shared-account"');
    expect(source).toContain('data-workbench-scope="shared-sessions"');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps shared sessions as an exportable read-only table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("sharedSessionColumns");
    expect(source).toContain("viewKey={`shared-sessions-${userId}`}");
    expect(source).toContain('scope="shared-sessions"');
    expect(source).toContain('exportTableId="shared-sessions"');
    expect(source).toContain('exportFileName="forekinghell-shared-sessions.csv"');
    expect(source).toContain('data-workbench-export-table="shared-sessions"');
    expect(source).toContain('mainTableLabel="Shared account recent sessions table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["date", "type", "session", "score", "holes"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
