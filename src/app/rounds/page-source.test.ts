import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/rounds/page.tsx"), "utf8");

describe("rounds desktop workbench page", () => {
  it("uses a direct mobile list hierarchy without the desktop selected-round inspector", () => {
    expect(source).toContain("<RoundsMobileOverview");
    expect(source).toContain("<RoundsMobileList");
    expect(source).toContain('className="hidden lg:grid"');
    expect(source).toContain('label="Latest round summary"');
    expect(source).toContain('label="Round supporting detail"');
    expect(source).toContain('value: "mix"');
    expect(source).toContain('value: "actions"');
  });

  it("keeps the round history table-first until the shared wide-monitor rail appears", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="rounds"');
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain('title="AI round rail"');
    expect(layoutBlock).toContain("RoundsWorkspace");
    expect(layoutBlock).toContain("RoundOpportunityFeaturePanel");
  });
});
