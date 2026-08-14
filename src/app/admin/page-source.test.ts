import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/page.tsx"), "utf8");
const adminDataSource = readFileSync(join(process.cwd(), "src/lib/admin.ts"), "utf8");

describe("admin overview desktop console", () => {
  it("uses the admin artwork variant in the protected console header", () => {
    expect(source).toContain('variant="admin"');
    expect(source).toContain("visual={");
    expect(source).toContain('sizes="192px"');
  });

  it("keeps recent users as an exportable admin table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="admin-overview-users"');
    expect(source).toContain('scope="admin-overview-users"');
    expect(source).toContain('data-workbench-scope="admin-overview-users"');
    expect(source).toContain('exportTableId="admin-overview-users"');
    expect(source).toContain('data-workbench-export-table="admin-overview-users"');
    expect(source).toContain('mainTableLabel="Admin recent users table"');
    expect(source).toContain('mainTableLabel="Admin recent users table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["user", "plan", "role", "sessions", "feed", "created", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the contextual AI admin rail on the protected console", () => {
    expect(source).toContain("DesktopInsightRail");
    expect(source).toContain('title="AI admin rail"');
    expect(source).toContain("prompts={adminWorkbenchPrompts}");
    expect(source).toContain('railBreakpoint="wide"');
    expect(source).not.toContain('railBreakpoint="2xl"');
    expect(source).toContain("rail={");
  });

  it("ships only the protected workbench graph on the desktop-only admin route", () => {
    for (const obsolete of [
      "AdminMobileShell",
      "AdminMobileOverview",
      "AdminOperationsQueue",
      "MobileStatusAction",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).not.toContain("Challenge attempts flagged");
    expect(source).not.toContain('value="Runbook ready"');
    expect(adminDataSource).not.toContain("sessionCount: 0,\n    feedCount: 0");
  });

  it("keeps operating-page links flat inside the single AdminSection Card", () => {
    const adminLinkSource =
      source.match(/export function AdminLink[\s\S]*?function SnapshotRow/)?.[0] ?? "";

    expect(adminLinkSource).toContain("<Item");
    expect(adminLinkSource).toContain("<ItemMedia");
    expect(adminLinkSource).toContain("<ItemContent>");
    expect(adminLinkSource).toContain("<ItemTitle>");
    expect(adminLinkSource).toContain("<ItemDescription");
    expect(adminLinkSource).toContain("data-admin-operating-link");
    expect(adminLinkSource).not.toMatch(/<Card(?:\s|>)/);
    expect(adminLinkSource).not.toContain("<CardContent");
  });
});
