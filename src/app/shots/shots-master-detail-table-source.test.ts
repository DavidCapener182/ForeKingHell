import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/shots/shots-master-detail-table.tsx"),
  "utf8",
);

describe("shots master-detail desktop table", () => {
  it("keeps the shot explorer as an exportable master-detail table", () => {
    expect(source).toContain('data-workbench-export-table="shots"');
    expect(source).toContain('data-main-table-target="true"');
    expect(source).toContain('aria-label="Shot explorer table"');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("SelectedShotDetail");
    expect(source).toContain('aria-label="Selected shot detail"');
    expect(source).toContain("ShotReviewButton");
    expect(source).toContain("<ShotReviewButton");
    expect(source).toContain("ShotBulkReviewButton");
    expect(source).toContain("View source");
    expect(source).toContain("Correction history");
    expect(source).toContain("Current review");
    expect(source).toContain("reviewConfidenceLabel");
    expect(source).toContain("reviewEvents.map");
    expect(source).not.toContain("ShotDeleteButton");
    expect(source).not.toContain('variant="destructive"');
    expect(source).toContain("data-selected-shot");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["club", "trust", "type", "shot", "file", "date", "advanced"]) {
      expect(source).toContain(`data-column="${column}"`);
    }

    for (const column of ["carry", "total", "side", "launch", "ballSpeed"]) {
      expect(source).toContain(`column="${column}"`);
    }
  });

  it("offers bounded batch exclusion and single-shot restoration without deleting rows", () => {
    expect(source).toContain("shotIds={selectedRows}");
    expect(source).toContain("<ShotBulkReviewButton");
    expect(source).toContain("isRestorableShotReviewStatus(shot.reviewStatus)");
    expect(source).toContain('shot.reviewStatus === "suggested_exclusion"');
    expect(source).toContain('"Keep"');
    expect(source).toContain('"Restore"');
    expect(source).toContain('"Review"');
    expect(source).not.toContain("Delete shot");
    expect(source).not.toContain("Delete");
  });

  it("keeps keyboard row selection controls for desktop table users", () => {
    expect(source).toContain("handleRowKeyDown");
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Home"');
    expect(source).toContain('event.key === "End"');
    expect(source).toContain("rowRefs.current[index]?.focus()");
  });
});
