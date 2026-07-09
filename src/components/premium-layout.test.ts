import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PageShell layout contract", () => {
  it("keeps app content shells full width", () => {
    const source = readFileSync(join(process.cwd(), "src/components/premium.tsx"), "utf8");
    const shellWidthsBlock = source.match(/const shellWidths = \{[\s\S]*?\};/)?.[0] ?? "";

    expect(shellWidthsBlock).toContain('"6xl": "max-w-none"');
    expect(shellWidthsBlock).toContain('"7xl": "max-w-none"');
    expect(shellWidthsBlock).toContain('wide: "max-w-none"');
    expect(shellWidthsBlock).toContain('full: "max-w-none"');
    expect(source).toContain('"!max-w-none"');
  });

  it("lets desktop table frames expose labelled regions", () => {
    const source = readFileSync(join(process.cwd(), "src/components/premium.tsx"), "utf8");
    const frameBlock =
      source.match(
        /export function DataTableFrame\([\s\S]*?\n}\n\nexport function MobileDataList/,
      )?.[0] ?? "";

    expect(frameBlock).toContain("label,");
    expect(frameBlock).toContain("stickyFirstColumn = false,");
    expect(frameBlock).toContain('mainTableId = "main-table",');
    expect(frameBlock).toContain("mainTableId?: string;");
    expect(frameBlock).toContain(
      "const regionLabel = label ?? (mainTable ? mainTableLabel : undefined);",
    );
    expect(frameBlock).toContain('data-sticky-table-header="true"');
    expect(frameBlock).toContain(
      'data-sticky-first-column={stickyFirstColumn ? "true" : undefined}',
    );
    expect(frameBlock).toContain('role={regionLabel ? "region" : undefined}');
    expect(frameBlock).toContain("aria-label={regionLabel}");
    expect(frameBlock).toContain('<div className="min-w-0">{children}</div>');
    expect(frameBlock).not.toContain("<ScrollArea");
  });

  it("standardises opt-in sticky first columns for desktop tables", () => {
    const frameSource = readFileSync(join(process.cwd(), "src/components/premium.tsx"), "utf8");
    const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(frameSource).toContain("stickyFirstColumn?: boolean;");
    expect(globalsSource).toContain('[data-sticky-first-column="true"]');
    expect(globalsSource).toContain(".data-table-scroll :where(th, td):first-child");
    expect(globalsSource).toContain('tr[data-state="selected"]');
    expect(globalsSource).toContain("td:first-child");
  });

  it("keeps desktop AI rails limited to workbench routes", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/app/desktop-workbench.tsx"),
      "utf8",
    );
    const railScopeBlock =
      source.match(/const desktopInsightRailScopes = new Set\([\s\S]*?\]\);/)?.[0] ?? "";

    expect(railScopeBlock).toContain('"shots"');
    expect(railScopeBlock).toContain('"bag"');
    expect(railScopeBlock).toContain('"coach"');
    expect(railScopeBlock).toContain('"data-chat"');
    expect(railScopeBlock).toContain('"courses"');
    expect(railScopeBlock).toContain('"rounds"');
    expect(railScopeBlock).toContain('"admin"');
    expect(railScopeBlock).toContain('"today"');
    expect(railScopeBlock).toContain('"progress"');
    expect(railScopeBlock).not.toContain('"dashboard"');
    expect(railScopeBlock).not.toContain('"practice"');
    expect(railScopeBlock).not.toContain('"speed"');
    expect(railScopeBlock).not.toContain('"training-load"');
    expect(railScopeBlock).not.toContain('"equipment"');
    expect(railScopeBlock).not.toContain('"handicap"');
    expect(railScopeBlock).not.toContain('"import"');
    expect(railScopeBlock).not.toContain('"rapsodo"');
    expect(railScopeBlock).not.toContain('"providers"');
    expect(railScopeBlock).not.toContain('"billing"');
    expect(railScopeBlock).not.toContain('"settings"');
    expect(railScopeBlock).not.toContain('"profile"');
    expect(railScopeBlock).not.toContain('"feed"');
    expect(railScopeBlock).not.toContain('"achievements"');
    expect(railScopeBlock).not.toContain('"challenges"');
    expect(railScopeBlock).not.toContain('"friends"');
    expect(railScopeBlock).not.toContain('"leaderboard"');
    expect(railScopeBlock).not.toContain('"partners"');
    expect(railScopeBlock).not.toContain('"social-intelligence"');
    expect(railScopeBlock).not.toContain('"tournaments"');
  });

  it("does not construct desktop AI rails on excluded route pages", () => {
    const excludedRouteFiles = [
      "src/app/achievements/page.tsx",
      "src/app/billing/page.tsx",
      "src/app/challenges/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/equipment/page.tsx",
      "src/app/feed/page.tsx",
      "src/app/friends/page.tsx",
      "src/app/groups/page.tsx",
      "src/app/handicap/page.tsx",
      "src/app/import/page.tsx",
      "src/app/leaderboard/page.tsx",
      "src/app/partners/page.tsx",
      "src/app/practice/page.tsx",
      "src/app/profile/page.tsx",
      "src/app/providers/page.tsx",
      "src/app/rapsodo/rapsodo-sync-client.tsx",
      "src/app/settings/page.tsx",
      "src/app/simulator-lab/page.tsx",
      "src/app/social-intelligence/page.tsx",
      "src/app/speed/page.tsx",
      "src/app/stats/training-over-time/page.tsx",
      "src/app/tournaments/page.tsx",
    ];

    for (const file of excludedRouteFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");

      expect(source, file).not.toContain("DesktopInsightRail");
      expect(source, file).not.toContain("WorkbenchPrompts");
      expect(source, file).not.toContain("rail={");
    }
  });
});
