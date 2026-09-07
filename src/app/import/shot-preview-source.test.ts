import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = readFileSync(join(process.cwd(), "src/app/import/shot-preview.tsx"), "utf8");
describe("import shot preview", () => {
  it("preserves local view controls without replacing full filtered export with a page-only export", () => {
    expect(source).toContain("<DesktopWorkbenchControls");
    expect(source).toContain("columns={importShotPreviewColumns}");
    expect(source).toContain('viewKey="import-shot-preview"');
    expect(source).toContain('scope="import-shot-preview"');
    expect(source).toContain("localView={{");
    expect(source).toContain("showExport={false}");
    expect(source).toContain("...filtered.map((shot)");
    expect(source).toContain('link.download = "import-preview-filtered.csv"');
    expect(source).toContain("Export {filtered.length} filtered shots");
  });
  it("retains accessible source identity, units, bounded paging and full correction details", () => {
    expect(source).toContain("TableCaption");
    expect(source).toContain('data-workbench-scope="import-shot-preview"');
    expect(source).toContain('data-workbench-export-table="import-shot-preview"');
    expect(source).toContain('aria-label="Parsed shot measurements"');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("sticky left-0 z-20");
    expect(source).toContain("filtered.slice(current * 20, current * 20 + 20)");
    for (const id of ["file", "carry", "total", "ball-speed", "launch", "side"])
      expect(source).toContain(`data-column="${id}"`);
    for (const label of [
      "Source club",
      "Brand",
      "Carry yd",
      "Total yd",
      "Ball speed mph",
      "Launch °",
      "Side yd",
      "Hole",
    ])
      expect(source).toContain(`"${label}"`);
    expect(source).toContain('label="Confirm club"');
    expect(source).toContain("onClubChange(active.fileId!, active.rowNumber, value)");
    expect(source).toContain("Original file evidence remains intact.");
  });
});
