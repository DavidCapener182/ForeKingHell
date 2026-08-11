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
    expect(source).toContain("ShotDeleteButton");
    expect(source).toContain("<ShotDeleteButton shotId={shot.id} />");
    expect(source).toContain("Filter this club");
    expect(source).toContain("encodeURIComponent(shot.clubType)");
    expect(source).toContain("data-selected-shot");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "date",
      "file",
      "shot",
      "hole",
      "club",
      "carry",
      "total",
      "side",
      "launch",
      "ballSpeed",
      "advanced",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
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
