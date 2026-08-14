import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/bag/distance-benchmark-panel.tsx"),
  "utf8",
);

describe("distance benchmark panel source", () => {
  it("keeps benchmark comparison tables captioned and keyboardable", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("benchmarkCarryColumns");
    expect(source).toContain("benchmarkMetricColumns");
    expect(source).toContain("benchmarkPeerColumns");
    expect(source).toContain("benchmarkSuggestedViews");
    expect(source).toContain("TableCaption");
    expect(source).toContain("stickyFirstColumn");

    for (const summaryId of [
      "distance-benchmark-carry-summary",
      "benchmark-summary",
      "peer-benchmark-comparison-summary",
    ]) {
      expect(source).toContain(summaryId);
    }

    expect(source).toContain("Carry benchmark table comparing each club");
    expect(source).toContain("benchmark table comparing each club");
    expect(source).toContain("Peer benchmark comparison table");
    expect(source).toContain('viewKey="distance-benchmark-carry"');
    expect(source).toContain('data-workbench-scope="distance-benchmark-carry"');
    expect(source).toContain('data-workbench-export-table="distance-benchmark-carry"');
    expect(source).toContain('viewKey="distance-benchmark-peers"');
    expect(source).toContain('data-workbench-scope="distance-benchmark-peers"');
    expect(source).toContain('data-workbench-export-table="distance-benchmark-peers"');
    expect(source).toContain("viewKey={`distance-benchmark-${metric.key}`}");
    expect(source).toContain("data-workbench-scope={`distance-benchmark-${metric.key}`}");
    expect(source).toContain("data-workbench-export-table={`distance-benchmark-${metric.key}`}");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("focus-aaa outline-none");
    expect(source).toContain("sticky left-0 z-20");

    for (const column of [
      "club",
      "model",
      "your-carry",
      "current-value",
      "metric-level",
      "metric-target",
      "metric-band",
      "peer-median",
      "top-quartile",
      "percentile",
      "peer-sample",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps peer benchmark percentiles as an on-demand comparison branch", () => {
    expect(source).toContain("peerBenchmarksLoaded");
    expect(source).toContain("Peer benchmarks are on demand");
    expect(source).toContain("Load peer benchmarks");
    expect(source).toContain('href="/bag?tab=evidence&peers=1#distance-benchmarks"');
    expect(source).toContain("Carry, speed and flight benchmarks are loaded.");
    expect(source).toContain("peerBenchmarksLoaded && peerChase");
  });

  it("explains the best-30 average and gives a real next-level shot plan", () => {
    expect(source).toContain("Best 30 avg");
    expect(source).toContain("longest clean full swings");
    expect(source).toContain("benchmarkAdvanceText");
    expect(source).toContain("shots at");
    expect(source).toContain("saved for this club");
    expect(source).not.toContain("Beat ${formatMetric(row.bestSampleFloorYd)} yd to lift set");
  });

  it("positions benchmark labels on the same percentage scale as the marker", () => {
    expect(source).toContain("function BenchmarkScaleLabels");
    expect(source).toContain("(index / Math.max(1, labels.length - 1)) * 100");
    expect(source).toContain("style={{ left: `${position}%` }}");
    expect(source).toContain("-translate-x-1/2");
    expect(source).not.toContain('className="grid grid-cols-5 text-[10px]');
  });

  it("uses semantic shadcn tabs, alerts, badges and sticky table surfaces", () => {
    const fixedPalette =
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i;

    expect(source).not.toMatch(fixedPalette);
    expect(source).toContain("<Tabs");
    expect(source).toContain("<Alert");
    expect(source).toContain("<AlertTitle");
    expect(source).toContain("<AlertDescription");
    expect(source).toContain("<Badge");
    expect(source).toContain("<Table");
    expect(source).not.toContain("<table");
    expect(source).toContain("shadow-[1px_0_0_hsl(var(--border))]");
    expect(source).toContain("var(--status-information-surface)");
  });
});
