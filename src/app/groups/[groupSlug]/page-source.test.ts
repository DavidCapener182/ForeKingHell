import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/groups/[groupSlug]/page.tsx"), "utf8");

describe("group detail desktop route", () => {
  it("keeps group detail pages as desktop operations workspaces", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="group-detail">');
    expect(source).toContain('id="group-operations"');
    expect(source).toContain('data-workbench-scope="group-members"');
    expect(source).toContain('data-workbench-export-table="group-member-roster"');
    expect(source).toContain('mainTableLabel="Group member roster table"');
    expect(source).toContain('mainTableLabel="Group member roster table" stickyFirstColumn');
    expect(source).toContain('data-workbench-scope="group-challenges"');
    expect(source).toContain('data-workbench-export-table="group-linked-challenges"');
    expect(source).toContain('label="Group linked challenges table" stickyFirstColumn');
    expect(source).toContain("Desktop roster, rivalry and linked challenge controls");
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
