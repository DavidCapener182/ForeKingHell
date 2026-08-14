import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/maps/shot-pattern-summary-drawer.tsx"),
  "utf8",
);

describe("shot pattern summary drawer theme chrome", () => {
  it("uses semantic shadcn surfaces without changing the golf summary contract", () => {
    const fixedPalette =
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i;

    expect(source).not.toMatch(fixedPalette);
    expect(source).toContain("<Card");
    expect(source).toContain("<CardContent");
    expect(source).toContain("<Alert");
    expect(source).toContain("<AlertDescription");
    expect(source).toContain("<Badge");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).toContain("var(--status-information-surface)");
    expect(source).toContain("targetLine?.beyondCapability");
    expect(source).toContain("landingSummary.expectedPenalty");
  });

  it("keeps metric tiles flat inside the one outer summary card", () => {
    const metricTile = source.slice(
      source.indexOf("function SummaryMetric"),
      source.indexOf("function outlierLabel"),
    );

    expect(source.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(metricTile).not.toContain("<Card");
    expect(metricTile).toContain("border-border bg-muted/35");
  });
});
