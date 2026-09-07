import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/handicap/page.tsx"), "utf8");

describe("handicap desktop score differential table", () => {
  it("renders a single full-width evidence workspace", () => {
    expect(source.match(/<PageShell/g)).toHaveLength(1);
    expect(source).toContain('<DesktopWorkbenchLayout scope="handicap">');
    expect(source).toContain("<LabEvidenceList");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
  });

  it("keeps score differentials in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="handicap-rounds"');
    expect(source).toContain('data-workbench-export-table="handicap-rounds"');
    expect(source).toContain('mainTableLabel="Score differential table"');
    expect(source).toMatch(/mainTableLabel="Score differential table"\s+stickyFirstColumn/);
    expect(source).toContain("forekinghell-handicap-score-differentials.csv");
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain('data-column="eligibility"');
    expect(source).toContain("handicapRoundEligibility");
    expect(source).toContain("Eligible with defaults");
    expect(source).toContain("Needs 9 or 18 holes");
    expect(source).toContain("hole score");
  });

  it("keeps the handicap page focused on scorecard evidence", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("keeps ordinary workbench controls and tables semantic across themes", () => {
    const ordinarySource = source.slice(0, source.indexOf("function HandicapTrendChart"));
    const chartSource = source.slice(source.indexOf("function HandicapTrendChart"));

    expect(ordinarySource).toContain("var(--status-warning-surface)");
    expect(ordinarySource).toContain("var(--status-success-surface)");
    expect(ordinarySource).toContain("bg-card/80");
    expect(ordinarySource).not.toMatch(
      /(?:bg|text|border)-(?:white|slate|emerald|green|amber|orange|red|rose|sky|blue|indigo|violet|purple)(?:-\d+|\/)|bg-\[#/,
    );
    expect(chartSource).toContain('stroke="var(--primary)"');
  });
});

describe("handicap mobile information architecture", () => {
  it("separates unofficial best form from conservative playing and range estimates", () => {
    const header = source.slice(source.indexOf("<PageHeader"), source.indexOf("<UrlTabs"));
    expect(header).toContain("Unofficial scoring estimates");
    expect(header).toContain('label: "Realistic playing"');
    expect(header).toContain("formatHandicapValue(playingHandicap.value)");
    expect(header).toContain("rangeReality.estimate.confidenceLabel");
    expect(header).toContain("not an official Handicap Index");
    expect(source).toContain("missingRatingRounds.length");
    expect(source).toContain("need rating/slope");
  });

  it("keeps calculation, trend, range and score history in persistent evidence sections", () => {
    expect(source).toContain("<UrlTabs");
    expect(source).toContain('label="Handicap evidence sections"');
    expect(source).toContain('defaultTabKey="estimates"');
    for (const id of ["estimates", "trend", "quality", "rounds"]) {
      expect(source).toContain(`id: "${id}"`);
    }
    expect(source).toContain("<PlayingHandicapPanel summary={playingHandicap}");
    expect(source).toContain("<RangeRealityDetailPanel reality={rangeReality}");
    expect(source).toContain("<HandicapTrendChart");
    expect(source).toContain('title="Round calculations"');
    expect(source).toContain('label: "Reason / assumptions"');
    expect(source).toContain("href: `/rounds/${round.id}`");
    const tabs = readFileSync(
      join(process.cwd(), "src/components/untitled-ui/url-tabs.tsx"),
      "utf8",
    );
    expect(tabs).toContain("keepMounted");
    expect(tabs).toContain("window.history.pushState");
  });
});
