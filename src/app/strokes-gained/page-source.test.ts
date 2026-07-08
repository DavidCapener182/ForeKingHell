import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/strokes-gained/page.tsx"), "utf8");

describe("strokes gained desktop workbench", () => {
  it("keeps the AI strokes-gained rail visible on standard desktop workbenches", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="strokes-gained"');
    expect(layoutBlock).not.toContain('railBreakpoint="wide"');
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI strokes-gained rail"');
  });

  it("gives the shot-event table saved views, column control, export and accessible metadata", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="strokes-gained-events"');
    expect(source).toContain('scope="strokes-gained"');
    expect(source).toContain('exportTableId="strokes-gained-events"');
    expect(source).toContain('data-workbench-export-table="strokes-gained-events"');
    expect(source).toContain('mainTableLabel="Strokes gained event table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("strokesGainedSuggestedViews");

    for (const column of [
      "round",
      "hole",
      "category",
      "from",
      "to",
      "distance",
      "expected-before",
      "expected-after",
      "sg",
      "status",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps the gain/loss waterfall chart explainable with fallback rows", () => {
    const waterfallBlock =
      source.match(/function GainLossWaterfall[\s\S]*?function PracticeThisFirstCard/)?.[0] ?? "";

    expect(waterfallBlock).toContain('role="img"');
    expect(waterfallBlock).toContain('aria-label="Strokes gained waterfall"');
    expect(waterfallBlock).toContain("ChartAccessibleFallback");
    expect(waterfallBlock).toContain('title="Strokes gained waterfall"');
    expect(waterfallBlock).toContain("summary={waterfallSummary}");
    expect(waterfallBlock).toContain("rows={waterfallRows}");
    expect(waterfallBlock).toContain('{ key: "category", label: "Category" }');
    expect(waterfallBlock).toContain('{ key: "pendingEvents", label: "Pending events" }');
  });
});
