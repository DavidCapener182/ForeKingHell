import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rounds/rounds-workspace.tsx"), "utf8");
const mobileSource = readFileSync(
  join(process.cwd(), "src/app/rounds/rounds-mobile-list.tsx"),
  "utf8",
);
const desktopRoundRows = source.slice(
  source.indexOf("<TableBody>"),
  source.indexOf("{sortedRounds.length === 0"),
);

describe("rounds desktop workspace source", () => {
  it("renders concise mobile rows and progressively discloses older rounds", () => {
    expect(mobileSource).toContain("export function RoundsMobileList");
    expect(mobileSource).toContain('label="Round type"');
    expect(mobileSource).toContain('label="Search and data filters"');
    expect(mobileSource).toContain("const recentRounds = filteredRounds.slice(0, 10)");
    expect(mobileSource).toContain("const olderRounds = filteredRounds.slice(10)");
    expect(mobileSource).toContain('label="Recent round history"');
    expect(mobileSource).toContain('label="Older round history"');
    expect(mobileSource).toContain("href={`/rounds/${round.id}`}");
    expect(source).not.toContain("export function RoundsMobileList");
    expect(source).not.toContain("IOSDisclosureGroup");
    expect(source).not.toContain("MobileFilterSheet");
    expect(mobileSource).not.toContain("DesktopWorkbenchControls");
    expect(mobileSource).not.toContain("DataTableFrame");
  });

  it("keeps round history as a controlled desktop workbench table", () => {
    expect(source).toContain("DesktopWorkbenchControls");
    expect(source).toContain('viewKey="rounds"');
    expect(source).toContain('scope="rounds"');
    expect(source).toContain('exportTableId="rounds"');
    expect(source).toContain('exportFileName="forekinghell-rounds-view.csv"');
    expect(source).toContain('data-workbench-scope="rounds"');
    expect(source).toContain('data-workbench-export-table="rounds"');
    expect(source).toContain('mainTableLabel="Round history table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("focus-aaa cursor-pointer");
    expect(source).toContain('aria-label="Round filters"');
    expect(source).toContain("data-filter-search");
    expect(source).toContain("data-page-search");

    for (const column of ["round", "date", "type", "score", "diff", "putts", "data", "actions"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps each desktop round row to one shadcn action menu", () => {
    expect(desktopRoundRows).toContain("<DropdownMenu>");
    expect(desktopRoundRows).toContain("<DropdownMenuTrigger asChild>");
    expect(desktopRoundRows).toContain("<DropdownMenuContent");
    expect(desktopRoundRows).toContain("<DropdownMenuItem onSelect=");
    expect(desktopRoundRows).toContain("<DropdownMenuItem asChild>");
    expect(desktopRoundRows).toContain("setSelectedRoundId(round.id)");
    expect(desktopRoundRows).toContain("href={`/rounds/${round.id}`}");
    expect(desktopRoundRows).toContain("event.target !== event.currentTarget");
    expect(desktopRoundRows.match(/<Button\b/g)).toHaveLength(1);
    expect(desktopRoundRows).not.toContain(
      'variant={round.id === selectedRound?.id ? "secondary" : "ghost"}',
    );
    expect(desktopRoundRows).not.toContain('<Button asChild variant="ghost" size="sm">');
  });
});
