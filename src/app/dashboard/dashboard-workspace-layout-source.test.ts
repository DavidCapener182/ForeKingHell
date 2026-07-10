import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/dashboard/dashboard-workspace-layout.tsx"),
  "utf8",
);

describe("dashboard workspace layout source", () => {
  it("uses container-responsive panel spans instead of fixed narrow desktop columns", () => {
    expect(source).toContain("@container/dashboard-workspace");
    expect(source).toContain("@container/dashboard-panel col-span-12 h-full min-w-0 [&>*]:h-full");
    expect(source).toContain("@container/dashboard-workspace grid auto-rows-auto items-stretch");
    expect(source).toContain("dashboardPanelSpanClass(span)");
    expect(source).toContain(
      "@[56rem]/dashboard-workspace:col-span-6 @[100rem]/dashboard-workspace:col-span-4",
    );
    expect(source).toContain("@[100rem]/dashboard-workspace:col-span-8");
    expect(source).not.toContain("gridColumn: `span ${span} / span ${span}`");
  });

  it("announces dashboard layout changes and disables impossible reorder moves", () => {
    expect(source).toContain("layoutStatusMessage");
    expect(source).toContain("layoutStatusTimerRef");
    expect(source).toContain("function announceLayoutStatus(message: string)");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-atomic="true"');
    expect(source).toContain(
      'announceLayoutStatus(`Dashboard layout set to ${mode.replace("-", " ")} mode.`)',
    );
    expect(source).toContain('announceLayoutStatus("Dashboard layout reset.")');
    expect(source).toContain('announceLayoutStatus("Keep at least one dashboard panel visible.")');
    expect(source).toContain("const firstPanel = controlIndex === 0");
    expect(source).toContain("const lastPanel = controlIndex === controlPanelIds.length - 1");
    expect(source).toContain("disabled={firstPanel}");
    expect(source).toContain("disabled={lastPanel}");
  });
});
