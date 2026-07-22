import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/challenges/[challengeId]/page.tsx"),
  "utf8",
);

describe("challenge detail desktop route", () => {
  it("keeps challenge detail pages as exportable command boards", () => {
    expect(source).toContain("<PageShell>");
    expect(source).not.toContain('<PageShell size="7xl"');
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="challenge-detail"');
    expect(source).toContain('id="challenge-command"');
    expect(source).toContain('data-workbench-scope="challenge-leaderboard"');
    expect(source).toContain('data-workbench-export-table="challenge-leaderboard"');
    expect(source).toContain('mainTableLabel="Challenge leaderboard table"');
    expect(source).toContain('mainTableLabel="Challenge leaderboard table" stickyFirstColumn');
    expect(source).toContain('data-workbench-scope="challenge-attempts"');
    expect(source).toContain('data-workbench-export-table="challenge-attempts"');
    expect(source).toContain('label="Challenge imported shot evidence table" stickyFirstColumn');
    expect(source).toContain("Exportable leaderboard and imported-shot evidence");
    expect(source).toContain("tabIndex={0}");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });
});
