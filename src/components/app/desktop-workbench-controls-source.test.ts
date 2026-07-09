import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/desktop-workbench-controls.tsx"),
  "utf8",
);

describe("desktop workbench controls source", () => {
  it("saves table views through an accessible in-app dialog", () => {
    expect(source).toContain("DialogContent");
    expect(source).toContain("DialogTitle");
    expect(source).toContain("DialogDescription");
    expect(source).toContain("Save table view");
    expect(source).toContain("View name");
    expect(source).toContain("openSaveCurrentViewDialog");
    expect(source).toContain("draftSavedViewTitle");
    expect(source).toContain("maxLength={80}");
    expect(source).toContain("const savedAt = new Date()");
    expect(source).toContain("const savedAtIso = savedAt.toISOString()");
    expect(source).not.toContain("Date.now()");
    expect(source).toContain("window.localStorage.setItem(savedViewsKey, JSON.stringify(next))");
    expect(source).toContain(
      'export const desktopSavedViewsUpdatedEvent = "fkh:desktop-saved-views-updated"',
    );
    expect(source).toContain(
      "window.dispatchEvent(new CustomEvent(desktopSavedViewsUpdatedEvent))",
    );
    expect(source).not.toContain("window.prompt");
  });

  it("keeps the desktop table control hooks for workbench pages", () => {
    expect(source).toContain("data-desktop-workbench-toolbar");
    expect(source).toContain("data-filter-toolbar");
    expect(source).toContain("data-filter-control");
    expect(source).toContain("data-export-current-view");
    expect(source).toContain("data-export-table-id={exportTableId}");
    expect(source).toContain("data-copy-current-view");
    expect(source).toContain("data-workbench-action-status");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-atomic="true"');
    expect(source).toContain("No exportable table found for this view.");
    expect(source).toContain("Current view link could not be copied.");
  });

  it("advertises table row keyboard shortcuts inside the desktop toolbar", () => {
    expect(source).toContain("data-table-row-shortcuts");
    expect(source).toContain(
      'aria-label="Table row shortcuts: arrow keys move rows, Enter or Space selects the focused row"',
    );
    expect(source).toContain("Rows");
    expect(source).toContain("Up/Down");
    expect(source).toContain("Enter");
    expect(source).toContain("select");
  });

  it("announces desktop table layout changes through the shared live region", () => {
    expect(source).toContain("layoutStatusMessage");
    expect(source).toContain("function announceLayoutStatus(message: string)");
    expect(source).toContain("layoutStatusTimerRef");
    expect(source).toContain("window.clearTimeout(layoutStatusTimerRef.current)");
    expect(source).toContain("setLayoutStatusMessage(message)");
    expect(source).toContain('setLayoutStatusMessage("")');
    expect(source).toContain("Saved table view");
    expect(source).toContain("Removed saved view");
    expect(source).toContain("Applied saved view with");
    expect(source).toContain("columns visible.");
    expect(source).toContain("Table layout reset to all columns and comfortable density.");
    expect(source).toContain('function updateDensity(nextDensity: "comfortable" | "compact")');
    expect(source).toContain("Table density set to");
    expect(source).toContain('aria-live="polite"');
  });

  it("lets desktop users reset table layout back to default columns and comfortable density", () => {
    expect(source).toContain("function resetTableLayout()");
    expect(source).toContain("Reset table layout");
    expect(source).toContain('setDensity("comfortable")');
    expect(source).toContain('window.localStorage.setItem(densityStorageKey, "comfortable")');
    expect(source).toContain("window.localStorage.setItem(visibleColumnsKey");
  });
});
