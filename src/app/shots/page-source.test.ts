import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/shots/page.tsx"), "utf8");
const masterDetailSource = readFileSync(
  join(process.cwd(), "src/app/shots/shots-master-detail-table.tsx"),
  "utf8",
);

describe("shots desktop workbench page", () => {
  it("keeps the shot explorer table-first until the shared wide-monitor rail appears", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="shots"');
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain('title="AI shot analyst"');
    expect(layoutBlock).toContain("DesktopTableWorkbenchControls");
    expect(layoutBlock).toContain('viewKey="shots"');
    expect(layoutBlock).toContain('exportTableId="shots"');
    expect(layoutBlock).toContain("ShotsMasterDetailTable");
    expect(masterDetailSource).toContain('data-workbench-scope="shots"');
    expect(masterDetailSource).toContain('data-workbench-export-table="shots"');
  });

  it("keeps the session import and shape evidence tables desktop-ready", () => {
    expect(source).toContain("shotSessionImportColumns");
    expect(source).toContain("shotSessionSuggestedViews");
    expect(source).toContain('viewKey="shots-session-imports"');
    expect(source).toContain('data-workbench-scope="shots-session-imports"');
    expect(source).toContain('data-workbench-export-table="shots-session-imports"');
    expect(source).toContain('exportFileName="forekinghell-shot-session-imports.csv"');
    expect(source).toContain('label="Session imports table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain('id="shots-session-imports-summary"');
    expect(source).toContain('aria-describedby="shots-session-imports-summary"');
    expect(source).toContain('data-workbench-scope="shots-shape-evidence"');
    expect(source).toContain('id="shots-shape-evidence-summary"');
    expect(source).toContain('aria-describedby="shots-shape-evidence-summary"');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");

    for (const column of ["file", "date", "type", "shots", "shot", "side", "shape"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });
});
