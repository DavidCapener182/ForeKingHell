import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/shots/page.tsx"), "utf8");
const tableSource = readFileSync(
  join(process.cwd(), "src/app/shots/shots-master-detail-table.tsx"),
  "utf8",
);
const filterSource = readFileSync(
  join(process.cwd(), "src/app/shots/shot-filter-toolbar.tsx"),
  "utf8",
);

describe("Shot Explorer analytics workbench", () => {
  it("keeps desktop focused on one toolbar, the evidence table and a right detail panel", () => {
    expect(pageSource).toContain("data-shots-desktop-workbench");
    expect(pageSource).toContain("<ShotFilterToolbar");
    expect(pageSource).toContain("<ShotsMasterDetailTable");
    expect(tableSource).toContain("lg:grid-cols-[minmax(0,1fr)_22rem]");
    expect(tableSource).toContain("inlineAtDesktop");
    expect(tableSource).toContain('aria-label="Selected shot detail"');
    expect(pageSource).not.toContain("DesktopShotDispersionMap");
    expect(pageSource).not.toContain("ShotPatternExplorer");
    expect(pageSource).not.toContain("DesktopInsightRail");
  });

  it("uses the requested shadcn primitives in one horizontal filter bar", () => {
    expect(filterSource).toContain("<Command>");
    expect(filterSource).toContain('role="combobox"');
    expect(filterSource).toContain("<Select");
    expect(filterSource).toContain("<Popover");
    expect(filterSource).toContain("<Sheet");
    expect(filterSource).toContain('aria-label="Search shots"');
    expect(filterSource).toContain('aria-label="Club filter"');
    expect(filterSource).toContain('label="Session"');
    expect(filterSource).toContain('label="Shot type"');
    expect(filterSource).toContain('aria-label="Date filter"');
    expect(filterSource).toContain('aria-label="Evidence status"');
    expect(filterSource).toContain("More filters");
    expect(filterSource).toContain('aria-label="Active filters"');
    expect(filterSource).toContain("removeFilter(filter.id)");
  });

  it("backs trusted and untrusted filters with the shared evidence rules", () => {
    expect(pageSource).toContain('trust: "all" | "trusted" | "untrusted"');
    expect(pageSource).toContain("function trustedShotWhere()");
    expect(pageSource).toContain("excludedRecordQualityTags");
    expect(pageSource).toContain("excludedRecordShotCategories");
    expect(pageSource).toContain('eq(shots.reviewStatus, "restored")');
    expect(pageSource).toContain('eq(shots.reviewStatus, "included")');
    expect(pageSource).toContain("not like 'exclude%'");
    expect(pageSource).toContain('filters.trust === "trusted"');
    expect(pageSource).toContain('filters.trust === "untrusted"');
    expect(pageSource).toContain("recordEligibility({");
  });

  it("provides a high-density, sortable and keyboard-operable table", () => {
    expect(tableSource).toContain('data-workbench-export-table="shots"');
    expect(tableSource).toContain('data-main-table-target="true"');
    expect(tableSource).toContain("max-h-[calc(100dvh-17rem)]");
    expect(tableSource).toContain("[&_th]:sticky");
    expect(tableSource).toContain("sticky left-10");
    expect(tableSource).toContain("tabular-nums");
    expect(tableSource).toContain("odd:bg-muted/10");
    expect(tableSource).toContain("handleRowKeyDown");
    expect(tableSource).toContain('event.key === "ArrowDown"');
    expect(tableSource).toContain('event.key === "ArrowUp"');
    expect(tableSource).toContain('event.key === "Home"');
    expect(tableSource).toContain('event.key === "End"');
    expect(pageSource).toContain("DesktopTableWorkbenchControls");
    expect(pageSource).toContain('viewKey="shots"');
    expect(pageSource).toContain('exportTableId="shots"');
  });

  it("keeps row actions inside a menu and exposes reversible review plus permanent deletion", () => {
    for (const action of [
      "Open",
      "Correct",
      "Exclude from stats",
      "Keep",
      "Restore",
      "View source",
    ]) {
      expect(tableSource).toContain(action);
    }
    expect(tableSource).toContain("<DropdownMenu");
    expect(tableSource).toContain("<ShotReviewButton");
    expect(tableSource).toContain("<ShotBulkReviewButton");
    expect(tableSource).toContain("<ShotDeleteButton");
    expect(tableSource).toContain("<ShotBulkDeleteButton");
    expect(tableSource).toContain("Delete permanently");
  });

  it("uses provider session mode to keep non-course simulator practice deletable", () => {
    expect(pageSource).toContain("rapsodoSyncSessions.providerSessionMode");
    expect(pageSource).toContain("providerMetadataBySessionId");
    expect(pageSource).toContain("providerKind: shot.providerKind");
    expect(pageSource).toContain("providerSessionMode: shot.providerSessionMode");
  });

  it("shows launch, flight, source, evidence and correction detail", () => {
    expect(tableSource).toContain('value="overview"');
    expect(tableSource).toContain('value="source"');
    expect(tableSource).toContain('value="history"');
    expect(tableSource).toContain("Key launch numbers");
    expect(tableSource).toContain("Ball flight");
    expect(tableSource).toContain("Source record");
    expect(tableSource).toContain("Evidence read");
    expect(tableSource).toContain("Correction history");
    expect(tableSource).toContain("Current review");
    expect(pageSource).toContain("shotReviewEvents");
    expect(pageSource).toContain("reviewEventsByShotId");
    expect(pageSource).toContain("effectiveShotReviewStatus({");
    expect(tableSource).toContain("Open Session Review");
  });

  it("shows compact dispersion only for a one-club filter", () => {
    expect(pageSource).toContain("dispersionClubLabel={");
    expect(pageSource).toContain("filters.club ? formatClubType(filters.club) : undefined");
    expect(pageSource).toContain("dispersionShots={filters.club ? dispersionPoints : []}");
    expect(tableSource).toContain("data-shot-mini-dispersion");
  });

  it("replaces the table with a deliberate phone handoff", () => {
    expect(pageSource).toContain("data-shots-mobile-handoff");
    expect(pageSource).toContain("lg:hidden");
    expect(pageSource).toContain("Session Review");
    expect(pageSource).toContain("Quick Bag");
    expect(tableSource).toContain("hidden min-w-0 gap-4 lg:grid");
  });
});
