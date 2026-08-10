import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/shared/[userId]/page.tsx"), "utf8");
const routeMetadataSource = readFileSync(
  join(process.cwd(), "src/components/app/route-metadata.ts"),
  "utf8",
);

describe("shared account desktop workspace source", () => {
  it("keeps shared access and recent sessions concise on mobile", () => {
    expect(source).toContain("MobileSharedAccount");
    expect(source).toContain("MobileSharedSessionRows");
    expect(source).toContain("IOSGroupedList");
    expect(source).toContain("IOSDisclosureGroup");
    expect(source).toContain('<MobileTopBar title="Shared account" />');
    expect(routeMetadataSource).toContain("if (/^\\/shared\\/[^/]+\\/?$/.test(pathname))");
    expect(routeMetadataSource).toContain('return { href: "/settings", label: "Settings" };');
    expect(source).toContain('className="hidden lg:grid"');
  });

  it("keeps shared account review inside the desktop workbench shell", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('scope="shared-account"');
    expect(source).toContain('data-workbench-scope="shared-sessions"');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps shared sessions as an exportable read-only table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("sharedSessionColumns");
    expect(source).toContain("viewKey={`shared-sessions-${userId}`}");
    expect(source).toContain('scope="shared-sessions"');
    expect(source).toContain('exportTableId="shared-sessions"');
    expect(source).toContain('exportFileName="forekinghell-shared-sessions.csv"');
    expect(source).toContain('data-workbench-export-table="shared-sessions"');
    expect(source).toContain('mainTableLabel="Shared account recent sessions table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["date", "type", "session", "score", "holes"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
