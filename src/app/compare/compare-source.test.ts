import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/compare/page.tsx"), "utf8");
const clubClientSource = readFileSync(
  join(process.cwd(), "src/app/compare/club-compare-client.tsx"),
  "utf8",
);
const progressClientSource = readFileSync(
  join(process.cwd(), "src/app/compare/progress-compare-client.tsx"),
  "utf8",
);

describe("compare desktop workbench", () => {
  it("keeps the contextual AI compare rail on the route", () => {
    expect(pageSource).toContain("DesktopInsightRail");
    expect(pageSource).toContain('title="AI compare rail"');
    expect(pageSource).toContain('scope="compare"');
    expect(pageSource).toContain('railBreakpoint="wide"');
    expect(pageSource).toContain("compareWorkbenchPrompts");
    expect(pageSource).toContain("comparisonBenefitTone");
  });

  it("keeps club comparison metrics as an exportable desktop table", () => {
    expect(clubClientSource).toContain("DesktopTableWorkbenchControls");
    expect(clubClientSource).toContain('viewKey="club-comparison-metrics"');
    expect(clubClientSource).toContain('scope="club-comparison-metrics"');
    expect(clubClientSource).toContain('data-workbench-scope="club-comparison-metrics"');
    expect(clubClientSource).toContain('exportTableId="club-comparison-metrics"');
    expect(clubClientSource).toContain('data-workbench-export-table="club-comparison-metrics"');
    expect(clubClientSource).toContain('mainTableLabel="Club comparison metrics table"');
    expect(clubClientSource).toContain(
      'mainTableLabel="Club comparison metrics table" stickyFirstColumn',
    );
    expect(clubClientSource).toContain('className="min-w-[920px]"');
    expect(clubClientSource).toContain("<TableCaption");
    expect(clubClientSource).toContain("tabIndex={0}");

    for (const column of ["metric", "club-a", "club-b", "difference", "better"]) {
      expect(clubClientSource).toContain(`data-column="${column}"`);
    }
  });

  it("keeps chart text alternatives alongside the visual compare charts", () => {
    expect(clubClientSource).toContain("ChartAccessibleFallback");
    expect(clubClientSource).toContain('title="Compare radar"');
    expect(clubClientSource).toContain('title="Club dispersion"');
  });

  it("keeps the period comparison table wide enough for stacked deltas", () => {
    const periodTableBlock =
      progressClientSource.match(/function PeriodTable[\s\S]*?function StackedValue/)?.[0] ?? "";

    expect(periodTableBlock).toContain('Table className="min-w-[920px]"');
    expect(periodTableBlock).toContain('className="min-w-36 text-right"');
    expect(periodTableBlock).toContain("<StackedDelta delta={period.deltaFromPrevious} />");
  });
});
