import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/analyse/page.tsx"), "utf8");

describe("Analyse hub", () => {
  it("uses the planned desktop tabs and compact evidence navigation", () => {
    expect(source).toContain("data-analyse-workspace-tabs");
    for (const tab of ["Overview", "Compare", "Shots", "Conditions", "Data Quality"]) {
      expect(source).toContain(`>${tab}</TabsTrigger>`);
    }
    expect(source).toContain("ConnectedMetricBar");
    expect(source).toContain("AnalyseProvenancePanel");
    expect(source).toContain("AppCommandContentTrigger");
    expect(source).toContain("<Alert");
    expect(source).toContain("var(--status-warning-surface)");
    expect(source).not.toContain("bg-amber-50");
    expect(source).toContain("AnalyseDestinationList");
    expect(source).not.toContain("AnalysisRoute");

    for (const href of ["/progress", "/analyse/compare", "/shots", "/bag", "/practice", "/coach"]) {
      expect(source).toContain(`href: "${href}"`);
    }

    expect(source).toContain("analysisConfidence({");
    expect(source).toContain("Test session impact");
    expect(source).toContain("Open analysis workspace");
    expect(source).toContain('href: "/analyse/workspace"');
  });

  it("ships one visible desktop workbench because companion traffic falls back to Sessions", () => {
    const capabilities = readFileSync(
      join(process.cwd(), "src/lib/app-route-capabilities.ts"),
      "utf8",
    );

    expect(capabilities).toContain(
      'analyse: desktopOnly(\n    "Review latest session",\n    "/sessions"',
    );
    expect(source).toContain("data-analyse-workspace-tabs");
    for (const obsoleteMobileSource of [
      "MobileAnalyseOverview",
      "MobileAppShell",
      "MobileTopBar",
      "BottomSheet",
      "@/components/app/ios-mobile",
      "lg:hidden",
      "hidden lg:",
    ]) {
      expect(source).not.toContain(obsoleteMobileSource);
    }
  });
});
