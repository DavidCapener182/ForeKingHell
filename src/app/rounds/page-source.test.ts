import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/rounds/page.tsx"), "utf8");
const summarySurfaceSource = readFileSync(
  join(process.cwd(), "src/app/rounds/round-summary-surfaces.tsx"),
  "utf8",
);

function functionBlock(name: string, nextName: string) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  return source.slice(start, end);
}

describe("rounds desktop workbench page", () => {
  it("selects a direct companion list without loading the desktop workspace", () => {
    expect(source).toContain("getRequestAppSurface()");
    expect(source).toContain('if (surface === "companion")');
    expect(source).toContain("<RoundsMobileOverview");
    expect(source).toContain("<RoundsMobileList");
    expect(source).toContain("data-rounds-companion");
    expect(source).toContain("data-rounds-workbench");
    expect(source).toContain('import("@/components/app/desktop-workbench")');
    expect(source).toContain('import("@/app/rounds/rounds-workspace")');
    expect(source).not.toMatch(/(?:^|\s)(?:lg:hidden|hidden lg:)/);
    expect(source).not.toMatch(
      /import\s*\{[^}]*RoundsWorkspace[^}]*\}\s*from\s*["']@\/app\/rounds\/rounds-workspace["']/,
    );
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

  it("keeps each rounds section to one Card and flattens its inner summary surfaces", () => {
    const hero = functionBlock("RoundsHero", "LatestRoundSpotlight");
    const latestRound = functionBlock("LatestRoundSpotlight", "HeroMetric");
    const heroMetric = functionBlock("HeroMetric", "RoundTasks");
    const tasks = functionBlock("RoundTasks", "RoundTaskLink");
    const taskLink = functionBlock("RoundTaskLink", "RoundTypeBreakdown");
    const breakdown = functionBlock("RoundTypeBreakdown", "BreakdownCard");
    const breakdownItem = functionBlock("BreakdownCard", "getRounds");

    expect(hero.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(tasks.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(breakdown.match(/<Card(?:\s|>)/g)).toHaveLength(1);

    for (const innerSurface of [latestRound, heroMetric, taskLink, breakdownItem]) {
      expect(innerSurface).not.toMatch(/<Card(?:\s|>)/);
    }

    expect(latestRound).toContain("data-latest-round-spotlight");
    expect(heroMetric).toContain("<RoundMetricItem");
    expect(taskLink).toContain("<RoundTaskItem");
    expect(breakdownItem).toContain("<RoundMetricItem");
    expect(summarySurfaceSource).toContain("<Item");
    expect(summarySurfaceSource).toContain("data-round-metric-item");
    expect(summarySurfaceSource).toContain("data-round-task-item");
    expect(summarySurfaceSource).not.toContain("@/components/ui/card");
  });
});
