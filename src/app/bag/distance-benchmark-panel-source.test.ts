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
});
