import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/groups/page.tsx"), "utf8");

describe("groups desktop board", () => {
  it("uses the groups artwork variant in the desktop group header", () => {
    expect(source).toContain('variant="groups"');
    expect(source).toContain('sizes="192px"');
    expect(source).toContain("priority");
  });

  it("keeps groups manageable through an exportable, filtered desktop table", () => {
    expect(source).toContain("GroupBoardTable");
    expect(source).toContain("<PageShell>");
    expect(source).toContain(
      '<GroupSectionTabs activeSection={activeSection} baseHref="/groups" />',
    );
    expect(source).toContain("parseGroupSection");
    expect(source).not.toContain("filterGroupBoardRows");
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="groups">');
    expect(source).not.toContain("getRequestAppSurface");
    expect(source).not.toContain('surface === "companion"');
    expect(source).toContain('await import("@/components/app/desktop-workbench")');
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="group-board"');
    expect(source).toContain('exportTableId="group-board"');
    expect(source).toContain('data-workbench-export-table="group-board"');
    expect(source).toContain('mainTableLabel="Group board table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('aria-label="Group operations rail"');
    expect(source).toContain('aria-label="Group activity digest"');
    expect(source).toContain('aria-labelledby="groups-heading"');
    expect(source).not.toContain("function GroupGrid");
    expect(source).not.toContain("GroupBoardFilterTabs");
    expect(source).not.toContain("Discoverable leagues");
    expect(source).not.toContain('title="My groups"');
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

  it("renders one active group board, activity digest or membership surface", () => {
    expect(source).toContain('activeSection === "overview"');
    expect(source).toContain('activeSection === "members"');
    expect(source).toContain('heading="Group overview"');
    expect(source).toContain('heading="My memberships"');
    expect(source).toContain("<GroupDigestFeaturePanel data={featureData} />");
    expect(source).toContain("groups={data.groups}");
    expect(source).toContain("groups={data.mine}");
    expect(source).not.toContain("getChallengesPageData");
    expect(source).not.toContain('description="Live group challenge"');
    expect(source).not.toMatch(
      /MobileAppShell|MobileLinkedGroupChallenges|mobileGroups|MobileTabBar|IOSGroupedList/,
    );
  });
});
