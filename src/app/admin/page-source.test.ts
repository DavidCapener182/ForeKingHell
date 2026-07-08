import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");

describe("admin overview desktop console", () => {
  it("uses the admin artwork variant in the protected console header", () => {
    expect(source).toContain('variant="admin"');
    expect(source).toContain("visual={");
    expect(source).toContain('sizes="192px"');
  });

  it("keeps recent users as an exportable admin table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="admin-overview-users"');
    expect(source).toContain('scope="admin-overview-users"');
    expect(source).toContain('data-workbench-scope="admin-overview-users"');
    expect(source).toContain('exportTableId="admin-overview-users"');
    expect(source).toContain('data-workbench-export-table="admin-overview-users"');
    expect(source).toContain('mainTableLabel="Admin recent users table"');
    expect(source).toContain('mainTableLabel="Admin recent users table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["user", "plan", "role", "sessions", "feed", "created", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the contextual AI admin rail on the protected console", () => {
    expect(source).toContain("DesktopInsightRail");
    expect(source).toContain('title="AI admin rail"');
    expect(source).toContain("prompts={adminWorkbenchPrompts}");
    expect(source).toContain('railBreakpoint="2xl"');
    expect(source).not.toContain('railBreakpoint="wide"');
    expect(source).toContain("rail={");
  });
});
