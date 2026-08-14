import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/groups/[groupSlug]/page.tsx"),
  "utf8",
);
const memberDialogSource = readFileSync(
  join(process.cwd(), "src/app/groups/group-members-dialog.tsx"),
  "utf8",
);

describe("group detail desktop route", () => {
  it("keeps group detail pages as desktop operations workspaces", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="group-detail">');
    expect(source).not.toContain("getRequestAppSurface");
    expect(source).not.toContain('surface === "companion"');
    expect(source).toContain('await import("@/components/app/desktop-workbench")');
    expect(source).toContain('id="group-operations"');
    expect(source).toContain('data-workbench-scope="group-members"');
    expect(source).toContain('data-workbench-export-table="group-member-roster"');
    expect(source).toContain('mainTableLabel="Group member roster table"');
    expect(source).toContain('mainTableLabel="Group member roster table" stickyFirstColumn');
    expect(source).toContain('data-workbench-scope="group-challenges"');
    expect(source).toContain('data-workbench-export-table="group-linked-challenges"');
    expect(source).toContain('label="Group linked challenges table" stickyFirstColumn');
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("renders exactly one Overview, Activity or Members work surface from the active tab", () => {
    expect(source).toContain("const activeSection = parseGroupDetailSection(flags?.section)");
    expect(source).toContain(
      "<GroupSectionTabs activeSection={activeSection} baseHref={sectionBaseHref} />",
    );
    expect(source).toContain('activeSection === "overview"');
    expect(source).toContain('activeSection === "activity"');
    expect(source).toContain("<GroupActivitySection data={data} />");
    expect(source).toContain("<GroupMemberTable");
    expect(source).toContain("<GroupChallengeTable");
    expect(source).not.toContain("<GroupOperationsBoard");
  });

  it("preserves real group authority without shipping a companion duplicate", () => {
    expect(source).not.toMatch(
      /MobileAppShell|MobileTabBar|MobileGroupFeed|MobileGroupOverviewDetails|MobileGroupMembers|IOSGroupedList/,
    );
    expect(source).toContain("data.canAdmin");
    expect(source).toContain("data.canAdmin && data.group.inviteCode");
    expect(source).toContain("value={data.group.memberCount}");
    expect(source).toContain("<GroupDangerActions");
    expect(source).toContain("<GroupMembersDialog");
    expect(source).not.toContain("records ready");
    expect(source).not.toContain('data.group.ownerUserId ? "Admin controls ready" : "Member view"');
    expect(memberDialogSource).toContain("AppEmptyState");
  });
});
