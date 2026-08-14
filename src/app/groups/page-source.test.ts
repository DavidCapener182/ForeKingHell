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
    expect(tabsSource).toContain('label: "My Groups"');
    expect(tabsSource).toContain('label: "Discover"');
    expect(tabsSource).toContain('label: "Invites"');
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
    expect(createSheetSource).toContain("<Sheet>");
    expect(createSheetSource).toContain("<SheetContent");
    expect(source).toContain("acceptGroupInviteAction");
    expect(source).toContain("declineGroupInviteAction");
    expect(source).toContain("joinGroupByInviteCodeAction");
  });

  it("keeps the clubhouse artwork without capping the app layout", () => {
    expect(source).toContain('variant="groups"');
    expect(source).toContain("<PageShell>");
    expect(source).not.toMatch(/max-w-6xl|max-w-7xl|max-w-\[1500px\]/);
  });
});
