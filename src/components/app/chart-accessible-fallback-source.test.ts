import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";

const source = readFileSync(
  join(process.cwd(), "src/components/app/chart-accessible-fallback.tsx"),
  "utf8",
);

describe("chart accessible fallback source", () => {
  it("keeps chart explanations tied to the visible summary and fallback rows", () => {
    expect(source).toContain("Explain this chart");
    expect(source).toContain("data-chart-summary={title}");
    expect(source).toContain("aria-label={`${title} chart data table`}");
    expect(source).toContain("buildChartExplainHref(title, summary, columns, rows)");
    expect(source).toContain("rows.slice(0, 8)");
    expect(source).toContain("Visible data rows");
    expect(source).toContain("row[column.key]");
    expect(source).toContain("Call out low-confidence or missing chart rows");
    expect(source).toContain("<Collapsible");
    expect(source).toContain("className={buttonVariants");
    expect(source).not.toContain("<CollapsibleTrigger asChild>");
    expect(source).toContain("data-chart-data-disclosure");
    expect(source).toContain("<Table");
    expect(source).toContain("<ButtonGroup");
    expect(source).not.toContain("<details");
    expect(source).not.toContain("<table");
  });

  it("renders flat by default inside chart cards and keeps a standalone Card opt-in", () => {
    const props = {
      title: "Test chart",
      summary: "One measured row.",
      columns: [{ key: "value", label: "Value" }],
      rows: [{ _key: "one", value: "1" }],
    };
    const embedded = renderToStaticMarkup(ChartAccessibleFallback(props));
    const standalone = renderToStaticMarkup(ChartAccessibleFallback({ ...props, embedded: false }));

    expect(embedded).toContain('data-chart-accessible-fallback="embedded"');
    expect(embedded).not.toContain('data-slot="card"');
    expect(standalone).toContain('data-chart-accessible-fallback="standalone"');
    expect(standalone).toContain('data-slot="card"');
    expect(source).toContain("embedded = true");
  });
});
