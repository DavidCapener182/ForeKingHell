import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rounds/page.tsx"), "utf8");

describe("rounds desktop workbench page", () => {
  it("keeps the round history table-first until wide-monitor workspace widths", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="rounds"');
    expect(layoutBlock).not.toContain('railBreakpoint="wide"');
    expect(layoutBlock).toContain('title="AI round rail"');
    expect(layoutBlock).toContain("RoundsWorkspace");
    expect(layoutBlock).toContain("RoundOpportunityFeaturePanel");
  });
});
