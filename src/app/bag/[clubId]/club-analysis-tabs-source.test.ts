import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/bag/[clubId]/club-analysis-tabs.tsx"),
  "utf8",
);

describe("club profile desktop shot evidence table", () => {
  it("ships only the open desktop analysis workbench", () => {
    expect(source).toContain("data-desktop-club-analysis");
    expect(source).toContain('className="grid scroll-mt-28 gap-3"');
    expect(source).toContain("afterDispersion ?");

    for (const unreachableMobileSymbol of [
      "mobileSupport",
      "IOSDisclosureGroup",
      "@/components/app/ios-mobile",
      "MobileSelectedShotMetrics",
      "MobileShotEvidenceRows",
      "data-mobile-shot-evidence",
      "lg:hidden",
      'className="hidden space-y-5 lg:block"',
      'className="hidden scroll-mt-28 gap-3 lg:grid"',
    ]) {
      expect(source).not.toContain(unreachableMobileSymbol);
    }
  });

  it("keeps club profile shots in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="club-shot-evidence-table"');
    expect(source).toContain('data-workbench-scope="club-shot-evidence"');
    expect(source).toContain('data-workbench-export-table="club-shot-evidence"');
    expect(source).toContain('mainTableLabel="Club shot evidence table"');
    expect(source).toContain('mainTableLabel="Club shot evidence table" stickyFirstColumn');
    expect(source).toContain("Shot evidence table");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("onClick={() => onSelect(shot.id)}");
  });

  it("keeps the club profile focused on data rather than a full AI slab", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps club profile charts labelled and backed by accessible fallback tables", () => {
    expect(source).toContain("ChartAccessibleFallback");
    expect(source).toContain("title={`${clubType} dispersion map`}");
    expect(source).toContain("summary={dispersionFallbackSummary");
    expect(source).toContain(
      "rows={dispersionFallbackRows(plottedShots, selectedShotId, distanceView)}",
    );
    expect(source).toContain('role="img"');
    expect(source).toContain('aria-label="Club trajectory"');
    expect(source).toContain('title="Club trajectory"');
    expect(source).toContain("summary={trajectoryFallbackSummary");
    expect(source).toContain("rows={trajectoryFallbackRows(trajectoryShots, selectedShotId)}");
  });

  it("keeps imported controls and ordinary surfaces semantic around the specialist golf palette", () => {
    const fixedPalette =
      /(?:bg|text|border|ring)-(?:white|black|slate|emerald|green|amber|orange|yellow|red|rose|pink|sky|blue|indigo|violet|purple|cyan|teal)(?:-|\b)|(?:bg|text|border|ring)-\[#|rgba\(|#[0-9a-f]{3,8}/i;
    const specialistCharts = source.slice(
      source.indexOf("function DispersionPanel"),
      source.indexOf("function ShotMetricStrip"),
    );
    const ordinaryUi = source.replace(specialistCharts, "");

    expect(ordinaryUi).not.toMatch(fixedPalette);
    expect(source).toContain("<ToggleGroup");
    expect(source).toContain("<ToggleGroupItem");
    expect(source).toContain("<Badge");
    expect(source).toContain("<Button");
    expect(source).not.toContain("<button");
    expect(source).toContain("shadow-[1px_0_0_hsl(var(--border))]");
    expect(source).toContain("var(--status-success-surface)");
    expect(specialistCharts).toContain('fill="#f7f8fb"');
    expect(specialistCharts).toContain('stroke="#2563eb"');
  });
});
