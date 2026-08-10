import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/handicap/page.tsx"), "utf8");

describe("handicap desktop score differential table", () => {
  it("keeps score differentials in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('data-workbench-scope="handicap-rounds"');
    expect(source).toContain('data-workbench-export-table="handicap-rounds"');
    expect(source).toContain('mainTableLabel="Score differential table"');
    expect(source).toContain('mainTableLabel="Score differential table" stickyFirstColumn');
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

  it("progressively discloses calculation, trend, range and score history", () => {
    const mobileBlock =
      source.match(/function HandicapMobileOverview[\s\S]*?function rangeRealityMobileTone/)?.[0] ??
      "";

    expect(mobileBlock).toContain("<IOSDisclosureGroup");
    for (const value of ["method", "trend", "range", "rounds", "quality"]) {
      expect(mobileBlock).toContain(`value: "${value}"`);
    }
    expect(mobileBlock).toContain("<HandicapTrendChart");
    expect(mobileBlock).toContain('label="Score differential history"');
    expect(source).toContain('scope="handicap" className="hidden lg:grid"');
  });
});
