import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/groups/[groupSlug]/page.tsx"),
  "utf8",
);

describe("group detail desktop route", () => {
  it("keeps group detail pages as desktop operations workspaces", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain(
      '<DesktopWorkbenchLayout scope="group-detail" className="hidden lg:grid">',
    );
    expect(source).toContain('id="group-operations"');
    expect(source).toContain('data-workbench-scope="group-members"');
    expect(source).toContain('data-workbench-export-table="group-member-roster"');
    expect(source).toContain('mainTableLabel="Group member roster table"');
    expect(source).toContain('mainTableLabel="Group member roster table" stickyFirstColumn');
    expect(source).toContain('data-workbench-scope="group-challenges"');
    expect(source).toContain('data-workbench-export-table="group-linked-challenges"');
    expect(source).toContain('label="Group linked challenges table" stickyFirstColumn');
    expect(source).toContain("Desktop roster, rivalry and linked challenge review");
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("has a native mobile group feed with secondary disclosures and real authority", () => {
    expect(source).toContain("<MobileAppShell>");
    expect(source).toContain("MobileGroupFeed");
    expect(source).toContain("MobileGroupDetails");
    expect(source).toContain("data.canAdmin");
    expect(source).toContain("data.canAdmin && data.group.inviteCode");
    expect(source).toContain("value={data.group.memberCount}");
    expect(source).toContain('[overflow-wrap:anywhere]">{data.group.name}</h1>');
    expect(source).not.toContain('aria-label="Back to groups"');
    expect(source).not.toContain("records ready");
    expect(source).not.toContain('data.group.ownerUserId ? "Admin controls ready" : "Member view"');
  });
});
