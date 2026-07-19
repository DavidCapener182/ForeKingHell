import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/app/app-shell.tsx"), "utf8");

describe("app shell desktop accessibility", () => {
  it("keeps skip links for content, sidebar and table-heavy pages", () => {
    expect(source).toContain('href="#main-content"');
    expect(source).toContain("Skip to content");
    expect(source).toContain('href="#app-sidebar"');
    expect(source).toContain("Skip to sidebar");
    expect(source).toContain("<MainTableSkipLink pathname={pathname} />");
    expect(source).toContain("Skip to main table");
    expect(source).toContain("resolveMainTableTarget()");
    expect(source).toContain('document.querySelector<HTMLElement>("[data-main-table-target');
    expect(source).toContain("table[data-workbench-export-table]");
  });

  it("clears stale main-table skip state when routes change", () => {
    expect(source).toContain("setHasMainTable(false);");
    expect(source).toContain("}, [pathname]);");
  });

  it("keeps sidebar density modes persisted and connected to the desktop sidebar", () => {
    expect(source).toContain('type SidebarDensity = "comfortable" | "compact" | "icon"');
    expect(source).toContain('const sidebarDensityStorageKey = "fkh:desktop-sidebar-density"');
    expect(source).toContain("window.localStorage.setItem(sidebarDensityStorageKey, nextDensity)");
    expect(source).toContain("data-sidebar-density={sidebarDensity}");
    expect(source).toContain("<SidebarDensityMenu");
    expect(source).toContain("aria-label={`Sidebar density: ${densityLabel}`}");
    expect(source).toContain("Comfortable");
    expect(source).toContain("Compact");
    expect(source).toContain("Icon-only");
  });

  it("uses sidebar semantic colours for every header and footer control", () => {
    expect(source).not.toContain("bg-[linear-gradient(180deg,var(--lux-ivory),#f4f7ef)]");
    expect(source).not.toContain("bg-[linear-gradient(180deg,#f8fbf3,var(--lux-ivory))]");
    expect(source).toContain('"border-b border-sidebar-border bg-sidebar text-sidebar-foreground"');
    expect(source).toContain('"border-t border-sidebar-border bg-sidebar text-sidebar-foreground"');
    expect(source).toContain("text-sidebar-accent-foreground");
    expect(source).toContain("text-sidebar-foreground/70");
  });

  it("defers private mobile navigation on public routes", () => {
    expect(source).toContain('import("@/components/app/mobile-nav")');
    expect(source).toContain(
      'import { DesktopWorkbenchChrome } from "@/components/app/desktop-workbench-chrome"',
    );
    expect(source).toContain("if (isPublicRoute(pathname))");
  });
});
