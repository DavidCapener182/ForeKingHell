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
    expect(source).toContain("window.localStorage.setItem(savedViewsKey, JSON.stringify(next))");
    expect(source).not.toContain("window.prompt");
  });

  it("keeps the desktop table control hooks for workbench pages", () => {
    expect(source).toContain("data-desktop-workbench-toolbar");
    expect(source).toContain("data-filter-toolbar");
    expect(source).toContain("data-filter-control");
    expect(source).toContain("data-export-current-view");
    expect(source).toContain("data-copy-current-view");
  });
});
