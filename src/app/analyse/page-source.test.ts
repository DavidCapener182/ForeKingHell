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
    expect(source).toContain("Choose a measured question, then inspect the records behind it.");
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

    for (const href of ["/analyse/conditions", "/analyse/workspace"]) {
      expect(source).toContain(`href="${href}"`);
    }

    expect(source).toContain("href={data.comparisonHref}");
    expect(source).toContain("sessionId: comparisonRows[0].id");
    expect(source).toContain("baselineSessionId: comparisonRows[1].id");
    expect(source).toContain("clubId: strongestPattern.clubId");
    expect(source).toContain("analysisConfidence({");
    expect(source).toContain("Advanced tools stay in the command centre");
    const provenance = readFileSync(
      join(process.cwd(), "src/app/analyse/analyse-provenance-panel.tsx"),
      "utf8",
    );
    expect(provenance).toContain("Evidence & calculation");
    expect(provenance).toContain("ResponsiveDetailPanel");
    expect(provenance).toContain('variant="outline"');
    for (const label of [
      "Trusted shots",
      "Useful sessions",
      "Bag coverage",
      "Excluded rows",
      "Date range",
      "Source",
      "Confidence inputs",
    ]) {
      expect(provenance).toContain(label);
    }
  });

  it("ships one responsive workspace available to companion and workbench", () => {
    const capabilities = readFileSync(
      join(process.cwd(), "src/lib/app-route-capabilities.ts"),
      "utf8",
    );

    expect(capabilities).toContain("analyse: companionMore()");
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
