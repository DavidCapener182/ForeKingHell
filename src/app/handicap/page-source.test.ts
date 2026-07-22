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
