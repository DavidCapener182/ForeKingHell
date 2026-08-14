import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/friends/page.tsx"), "utf8");
const tabsSource = readFileSync(join(process.cwd(), "src/app/friends/friends-tabs.tsx"), "utf8");

describe("friends desktop manager", () => {
  it("keeps relationship views as query links in a shadcn ButtonGroup", () => {
    expect(tabsSource).toContain("<ButtonGroup");
    expect(tabsSource).toContain('aria-label="Friend sections"');
    expect(tabsSource).toContain("<Button");
    expect(tabsSource).toContain('variant={active ? "secondary" : "ghost"}');
    expect(tabsSource).toContain("href={tab.href}");
    expect(tabsSource).toContain('aria-current={active ? "page" : undefined}');
    expect(tabsSource).not.toContain("TabsTrigger");
    expect(tabsSource).not.toContain('from "@/components/ui/tabs"');
  });

  it("keeps the friend graph table exportable, captioned and keyboard-focusable", () => {
    expect(source).toContain("FriendGraphTable");
    expect(source).toContain("<PageShell>");
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("buildFriendGraphRows");
    expect(source).toContain('data-workbench-scope="friend-graph"');
    expect(source).toContain('exportTableId="friend-graph"');
    expect(source).toContain('data-workbench-export-table="friend-graph"');
    expect(source).toContain('mainTableLabel="Friend graph table"');
    expect(source).toContain('mainTableLabel="Friend graph table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("FriendInviteDialog");
    expect(source).toContain("FriendsTabs");
    expect(source).toContain("FriendActionMenu");
    expect(source).toContain("<Item");
    expect(source).toContain('aria-label="Search public profiles by username"');
    expect(source).not.toContain('title="Incoming requests"');
    expect(source).not.toContain('title="Outgoing requests"');
    expect(source).not.toContain('title="Suggested friends"');
    expect(source).not.toContain("CompareWithFriendPanel");
    expect(source).not.toContain("ProfileList");
    expect(source).not.toContain("RequestList");
    expect(source).not.toContain("BlockedList");
    expect(source).not.toContain('<PageShell size="6xl">');

    for (const column of [
      "golfer",
      "status",
      "visibility",
      "home-course",
      "monitor",
      "handicap",
      "action",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps one tab-controlled desktop relationship manager without a companion bundle", () => {
    expect(source).toContain('<DesktopWorkbenchLayout scope="friends">');
    expect(source).toContain("<FriendsTabs activeTab={activeTab} />");
    expect(source).toContain(
      "<FriendGraphTable rows={friendGraphRows} query={query} activeTab={activeTab} />",
    );
    expect(source).toContain("const friendGraphRows = filterFriendGraphRows(");
    expect(source).toContain('await import("@/components/app/desktop-workbench")');
    expect(source).not.toContain("getRequestAppSurface");
    expect(source).not.toContain('surface === "companion"');
    expect(source).not.toMatch(
      /MobileAppShell|MobileFriendRequests|MobileFriendList|MobileFriendSearch|MobileFriendDetails|MobileRouteHeader|IOSGroupedList/,
    );
  });

  it("opens each suggested relationship view on the tab that owns its target", () => {
    expect(source).toContain('href: "/friends?tab=incoming#friend-graph-table"');
    expect(source).toContain('href: "/friends?tab=discover#find-friends"');
    expect(source).toContain('href: "/friends?tab=blocked#friend-graph-table"');
    expect(source).not.toContain('href: "#find-friends"');
    expect(source).not.toContain('href: "#blocked-users"');
  });
});
