import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
  });
});
