import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/handicap/page.tsx"), "utf8");

describe("handicap desktop score differential table", () => {
  it("branches companion and workbench trees at request time", () => {
    expect(source).toContain("getRequestAppSurface()");
    expect(source).toContain(
      'surface === "workbench" ? await import("@/components/app/desktop-workbench") : null',
    );
    expect(source).toContain('surface === "companion" ? (');
    expect(source).toContain(
      'surface === "workbench" && DesktopWorkbenchLayout && DesktopTableWorkbenchControls ? (',
    );
    expect(source).not.toMatch(
      /import \{[^}]*Desktop(?:TableWorkbenchControls|WorkbenchLayout)[^}]*\} from "@\/components\/app\/desktop-workbench"/,
    );
    expect(source).not.toContain('className="hidden lg:grid"');
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
  it("leads with the conservative playing estimate and visible confidence tasks", () => {
    const mobileBlock =
      source.match(/function HandicapMobileOverview[\s\S]*?function rangeRealityMobileTone/)?.[0] ??
      "";

    expect(mobileBlock).toContain("data-handicap-mobile-overview");
    expect(mobileBlock).toContain('title="Handicap"');
    expect(mobileBlock).toContain('label="Playing estimate"');
    expect(mobileBlock).toContain('label="Movement"');
    expect(mobileBlock).toContain('label="Rating or slope needed"');
    expect(mobileBlock).toContain("data-primary-action");
    expect(mobileBlock.indexOf('label="Playing estimate"')).toBeLessThan(
      mobileBlock.indexOf('title={<span id="handicap-depth-mobile">Evidence</span>}'),
    );
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
