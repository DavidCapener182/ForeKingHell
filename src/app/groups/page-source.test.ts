import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/groups/page.tsx"), "utf8");

describe("groups desktop board", () => {
  it("uses the groups artwork variant in the desktop group header", () => {
    expect(source).toContain('variant="groups"');
    expect(source).toContain('sizes="192px"');
    expect(source).toContain("priority");
  });

  it("keeps groups manageable through an exportable, filtered desktop table", () => {
    expect(source).toContain("GroupBoardTable");
    expect(source).toContain("<PageShell>");
    expect(source).toContain("GroupBoardFilterTabs");
    expect(source).toContain("filterGroupBoardRows");
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="groups" className="hidden sm:grid">');
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="group-board"');
    expect(source).toContain('exportTableId="group-board"');
    expect(source).toContain('data-workbench-export-table="group-board"');
    expect(source).toContain('mainTableLabel="Group board table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('aria-label="Group operations rail"');
    expect(source).toContain('aria-label="Group activity digest rail"');
    expect(source).toContain('aria-labelledby="groups-heading"');
    expect(source).not.toContain('<PageShell size="7xl">');
    expect(source).not.toContain("DesktopInsightRail");

    for (const column of [
      "group",
      "status",
      "visibility",
      "type",
      "members",
      "posts",
      "challenges",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
