import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/groups/[groupSlug]/page.tsx"),
  "utf8",
);
const tabsSource = readFileSync(
  join(process.cwd(), "src/app/groups/group-section-tabs.tsx"),
  "utf8",
);
const memberDialogSource = readFileSync(
  join(process.cwd(), "src/app/groups/group-members-dialog.tsx"),
  "utf8",
);
const dangerSource = readFileSync(
  join(process.cwd(), "src/app/groups/group-danger-actions.tsx"),
  "utf8",
);

describe("group clubhouse detail", () => {
  it("uses the required Overview, Activity and Members tabs", () => {
    expect(tabsSource).toContain('label: "Overview"');
    expect(tabsSource).toContain('label: "Activity"');
    expect(tabsSource).toContain('label: "Members"');
    expect(source).toContain('activeSection === "overview"');
    expect(source).toContain('activeSection === "activity"');
    expect(source).toContain("<GroupOverview data={data} />");
    expect(source).toContain("<GroupActivity data={data} />");
    expect(source).toContain("<GroupMembers data={data} />");
  });

  it("makes overview about the group, live play and what is next", () => {
    expect(source).toContain("About this group");
    expect(source).toContain("Current challenge");
    expect(source).toContain("Recent group performance");
    expect(source).toContain("Next event");
    expect(source).toContain("data.group.description");
    expect(source).toContain("data.group.currentChallenge");
    expect(source).toContain("data.rivalry.standings");
    expect(source).toContain("data.nextEvent");
  });

  it("keeps the feed and member roster compact instead of using admin tables", () => {
    expect(source).toContain("data.posts.map");
    expect(source).toContain("data.members.map");
    expect(source).toContain("<Item");
    expect(source).not.toContain("DataTableFrame");
    expect(source).not.toContain("DesktopTableWorkbenchControls");
    expect(source).not.toContain("<Table");
    expect(source).not.toContain("DesktopWorkbenchLayout");
  });

  it("opens members in a dialog and confirms leave or delete in an alert dialog", () => {
    expect(source).toContain("<GroupMembersDialog");
    expect(memberDialogSource).toContain("<Dialog>");
    expect(memberDialogSource).toContain("<DialogContent");
    expect(source).toContain("<GroupDangerActions");
    expect(dangerSource).toContain("<AlertDialog>");
    expect(dangerSource).toContain("Delete group");
    expect(dangerSource).toContain("Leave group");
  });
});
