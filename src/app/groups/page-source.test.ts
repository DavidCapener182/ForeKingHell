import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/groups/page.tsx"), "utf8");
const tabsSource = readFileSync(
  join(process.cwd(), "src/app/groups/group-directory-tabs.tsx"),
  "utf8",
);
const createSheetSource = readFileSync(
  join(process.cwd(), "src/app/groups/group-create-sheet.tsx"),
  "utf8",
);

describe("groups membership directory", () => {
  it("uses one membership-led directory with the required tabs", () => {
    expect(tabsSource).toContain('["mine", "My groups"]');
    expect(tabsSource).toContain('["discover", "Discover"]');
    expect(tabsSource).toContain('["invites", "Invitations"]');
    expect(source).toContain("<GroupClubList");
    expect(source).toContain("<GroupClubRow");
    expect(source).not.toContain("GroupBoardTable");
    expect(source).not.toContain("DataTableFrame");
    expect(source).not.toContain("DesktopWorkbenchLayout");
    expect(source).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain("<Table");
  });

  it("shows membership, activity, challenge and privacy on each group", () => {
    expect(source).toContain('label="Members"');
    expect(source).toContain('label="Latest activity"');
    expect(source).toContain('label="Current challenge"');
    expect(source).toContain('label="Privacy"');
    expect(source).toContain("group.avatarUrl");
    expect(source).toContain("group.memberCount");
    expect(source).toContain("group.latestActivity");
    expect(source).toContain("group.currentChallenge");
    expect(source).toContain("Open");
  });

  it("keeps creation in a sheet and invitations actionable", () => {
    expect(source).toContain("<GroupCreateSheet");
    expect(createSheetSource).toContain("<ResponsiveDetailPanel");
    expect(createSheetSource).toContain("No members are invited automatically");
    expect(source).toContain('operation="accept"');
    expect(source).toContain('operation="decline"');
    expect(source).toContain('operation="code"');
  });

  it("keeps a clear page header without capping the app layout", () => {
    expect(source).toContain("<PageHeader");
    expect(source).toContain("<PageShell>");
    expect(source).not.toMatch(/max-w-6xl|max-w-7xl|max-w-\[1500px\]/);
  });
});
