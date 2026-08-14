import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/friends/page.tsx"), "utf8");
const directorySource = readFileSync(
  join(process.cwd(), "src/app/friends/people-directory.tsx"),
  "utf8",
);
const menuSource = readFileSync(
  join(process.cwd(), "src/app/friends/friend-action-menu.tsx"),
  "utf8",
);
const tabsSource = readFileSync(join(process.cwd(), "src/app/friends/friends-tabs.tsx"), "utf8");

describe("friends people directory", () => {
  it("keeps the five relationship views as query links", () => {
    expect(tabsSource).toContain("<ButtonGroup");
    expect(tabsSource).toContain('aria-label="Friend sections"');
    for (const label of ["Friends", "Incoming", "Sent", "Discover", "Blocked"]) {
      expect(tabsSource).toContain(`label: "${label}"`);
    }
    expect(tabsSource).toContain('aria-current={active ? "page" : undefined}');
    expect(tabsSource).not.toContain("TabsTrigger");
  });

  it("renders one responsive people directory for every active tab", () => {
    expect(pageSource).toContain(
      "<PeopleDirectory rows={rows} query={query} activeTab={activeTab} />",
    );
    expect(pageSource).toContain("buildPeopleDirectoryRows");
    expect(pageSource).toContain('<DesktopWorkbenchLayout scope="friends">');
    expect(pageSource).toContain("<FriendsTabs activeTab={activeTab} />");
    expect(directorySource).toContain("export function PeopleDirectory");
    expect(directorySource).toContain("<DataTableFrame");
    expect(directorySource).toContain('className="hidden min-[1024px]:block"');
    expect(directorySource).toContain('className="min-w-0 min-[1024px]:hidden"');
    expect(directorySource).toContain("<PeopleTableRow");
    expect(directorySource).toContain("<PeopleItemRow");
    expect(directorySource).toContain("<TableCaption");
    expect(directorySource).toContain("<Item");
  });

  it("keeps every required person field and one contextual menu per row", () => {
    expect(directorySource).toContain("<SocialAvatar");
    expect(directorySource).toContain("row.profile.displayName");
    expect(directorySource).toContain("@{row.profile.username}");
    expect(directorySource).toContain("row.profile.homeCourse");
    expect(directorySource).toContain("row.profile.handicapBand");
    expect(directorySource).toContain("connectionLabel(row)");
    expect(directorySource).toContain("<PeopleActionMenu");
    expect(menuSource).toContain("<DropdownMenu");
    expect(menuSource).toContain("Profile");
    expect(menuSource).toContain("Invite to group");
    expect(menuSource).toContain("Remove");
    expect(menuSource).toContain("Accept");
    expect(menuSource).toContain("Decline");
    expect(menuSource).toContain("Unblock");
  });

  it("places discover search above recommended golfers", () => {
    const searchIndex = directorySource.indexOf('id="find-friends"');
    const recommendedIndex = directorySource.indexOf('label: "Recommended golfers"');
    expect(searchIndex).toBeGreaterThan(-1);
    expect(recommendedIndex).toBeGreaterThan(searchIndex);
    expect(directorySource).toContain('aria-label="Search golfers by username or name"');
    expect(pageSource).toContain('section: "recommended"');
  });

  it("does not reintroduce duplicate request or friend panels", () => {
    const combined = `${pageSource}\n${directorySource}`;
    expect(combined).not.toContain("FriendGraphTable");
    expect(combined).not.toContain("DesktopTableWorkbenchControls");
    expect(combined).not.toContain("ProfileList");
    expect(combined).not.toContain("RequestList");
    expect(combined).not.toContain("BlockedList");
    expect(combined).not.toContain("SocialStat");
    expect(combined).not.toContain("premium-hero");
    expect(combined).not.toContain("max-w-6xl");
    expect(combined).not.toContain("max-w-7xl");
  });
});
