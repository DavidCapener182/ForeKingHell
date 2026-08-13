import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const detail = readFileSync(join(root, "src/components/app/responsive-detail-panel.tsx"), "utf8");
const filters = readFileSync(join(root, "src/components/app/responsive-filter-panel.tsx"), "utf8");

describe("responsive application panels", () => {
  it("uses a Drawer on phone, a Sheet on workbench and an optional ultrawide inline panel", () => {
    expect(detail).toContain('window.matchMedia("(max-width: 767px)")');
    expect(detail).toContain('window.matchMedia("(min-width: 1600px)")');
    expect(detail).toContain('data-responsive-detail-panel="drawer"');
    expect(detail).toContain('data-responsive-detail-panel="sheet"');
    expect(detail).toContain('data-responsive-detail-panel="inline"');
    expect(detail).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(detail).toContain("open={open}");
    expect(detail).toContain("onOpenChange={onOpenChange}");
  });

  it("keeps active-filter count, clear-all and explicit apply semantics in one shared panel", () => {
    expect(filters).toContain("activeCount");
    expect(filters).toContain("Clear all");
    expect(filters).toContain("applyAction");
    expect(filters).toContain("ResponsiveDetailPanel");
  });
});
