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
    expect(source).toContain("@container/dashboard-panel col-span-12 min-w-0");
    expect(source).toContain("@container/dashboard-workspace grid auto-rows-auto items-start");
    expect(source).toContain("dashboardPanelSpanClass(span)");
    expect(source).toContain(
      "@[56rem]/dashboard-workspace:col-span-6 @[100rem]/dashboard-workspace:col-span-4",
    );
    expect(source).toContain("@[100rem]/dashboard-workspace:col-span-8");
    expect(source).not.toContain("gridColumn: `span ${span} / span ${span}`");
  });
});
