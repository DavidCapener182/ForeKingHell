import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/analyse/page.tsx"), "utf8");

describe("Analyse hub", () => {
  it("uses direct route navigation and an asymmetric editorial overview", () => {
    expect(source).toContain("data-analyse-workspace");
    for (const tab of ["Overview", "Compare", "Shots", "Conditions", "Data Quality"]) {
      expect(source).toContain(`["${tab}",`);
    }
    expect(source).not.toContain("TabsTrigger");
    expect(source).not.toContain("FocusedAnalysis");
    expect(source).toContain("ConnectedMetricBar");
    expect(source).toContain("AnalyseProvenancePanel");
    expect(source).toContain("AppCommandContentTrigger");
    expect(source).toContain("What does the data say?");
    expect(source).toContain("Understand what changed");
    expect(source).toContain("Find your real dispersion and miss");
    expect(source).toContain("See how environment changes your numbers");
    expect(source).toContain("Know what evidence you can trust");
    expect(source).toContain("xl:grid-cols-12");
    expect(source).toContain("ComparisonGraphic");
    expect(source).toContain("DispersionGraphic");
    expect(source).toContain("ConfidenceDistribution");
    expect(source).not.toContain("AnalyseDestinationList");
    expect(source).not.toContain("AnalysisRoute");

    for (const href of ["/analyse/compare", "/analyse/conditions", "/analyse/workspace"]) {
      expect(source).toContain(`href="${href}"`);
    }

    expect(source).toContain("analysisConfidence({");
    expect(source).toContain("Advanced tools stay in the command centre");
    const provenance = readFileSync(
      join(process.cwd(), "src/app/analyse/analyse-provenance-panel.tsx"),
      "utf8",
    );
    expect(provenance).toContain("Evidence & calculation");
    expect(provenance).toContain("ResponsiveDetailPanel");
    expect(provenance).toContain("bg-[#0b2a1d] text-white");
    expect(provenance).toContain("hover:bg-[#123c2b]");
  });

  it("ships one visible desktop workbench because companion traffic falls back to Sessions", () => {
    const capabilities = readFileSync(
      join(process.cwd(), "src/lib/app-route-capabilities.ts"),
      "utf8",
    );

    expect(capabilities).toContain(
      'analyse: desktopOnly(\n    "Review latest session",\n    "/sessions"',
    );
    expect(source).toContain("data-analyse-workspace");
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
