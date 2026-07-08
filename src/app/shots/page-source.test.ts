import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/shots/page.tsx"), "utf8");

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
  });
});
