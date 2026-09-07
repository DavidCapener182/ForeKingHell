import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/challenges/page.tsx"),
  "utf8",
);

describe("admin challenges desktop console source", () => {
  it("uses the shared challenge operations workbench without adding a contextual AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<AdminNav active="/admin/challenges" />');
    expect(source).toContain("getAdminChallengesData()");
    expect(source.match(/<PageShell>/g)).toHaveLength(1);
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps the extracted challenge board register exportable and configurable", () => {
    const register = readFileSync(
      join(process.cwd(), "src/app/admin/admin-challenge-board-register.tsx"),
      "utf8",
    );
    expect(source).toContain("<AdminChallengeBoardRegister");
    expect(register).toContain("<DesktopWorkbenchControls");
    for (const attribute of [
      "viewKey",
      "scope",
      "data-workbench-scope",
      "data-workbench-export-table",
    ]) {
      expect(register).toContain(`${attribute}="admin-challenge-boards"`);
    }
    expect(register).toContain('exportFileName="admin-challenge-boards-filtered.csv"');
    expect(register).toContain(
      "localView={{ state: { query, status, sort, dir }, restore: update }}",
    );
    expect(register).toContain("shown.map((row) => (");
    expect(register).toContain("data-column={column.id}");
    expect(register).toContain("tabIndex={0}");
    expect(register).toContain("<caption");
    for (const column of [
      "title",
      "id",
      "owner",
      "template",
      "status",
      "visibility",
      "entries",
      "attempts",
      "results",
      "starts",
      "ends",
      "created",
    ]) {
      expect(register).toContain(`id: "${column}"`);
    }
    expect(register).toContain("<ResponsiveDetailPanel");
    expect(register).toContain("a.entries - b.entries");
    expect(register).toContain("a.attempts - b.attempts");
  });

  it("excludes the obsolete companion challenge queue from this desktop-only route", () => {
    for (const obsolete of [
      "AdminMobileShell",
      "AdminMobileChallenges",
      "MobileAdminChallengeRows",
      "MobileTabBar",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });
});
