import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/friends/page.tsx"), "utf8");

describe("friends desktop manager", () => {
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
    expect(source).toContain('id="blocked-users"');
    expect(source).toContain('aria-label="Friend invite rail"');
    expect(source).toContain('aria-label="Friend discovery rail"');
    expect(source).toContain('aria-label="Friend safety rail"');
    expect(source).toContain('aria-label="Search public profiles by username"');
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

  it("uses a purpose-built mobile relationship inbox with secondary management", () => {
    expect(source).toContain("<MobileAppShell>");
    expect(source).toContain("MobileFriendRequests");
    expect(source).toContain("MobileFriendList");
    expect(source).toContain("MobileFriendSearch");
    expect(source).toContain("MobileFriendDetails");
    expect(source).toContain("rows.slice(0, 3)");
    expect(source).toContain('<DesktopWorkbenchLayout scope="friends" className="hidden lg:grid">');
    expect(source).not.toContain('<MobileRouteHeader title="Social"');
  });
});
