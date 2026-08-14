import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Analyse companion and workbench boundaries", () => {
  it("keeps the desktop-only hub to one visible workbench tree", () => {
    const page = source("src/app/(app)/analyse/page.tsx");
    const capabilities = source("src/lib/app-route-capabilities.ts");

    expect(capabilities).toContain(
      'analyse: desktopOnly(\n    "Review latest session",\n    "/sessions"',
    );
    expect(page).toContain("data-analyse-workspace");
    expect(page).toContain("ConnectedMetricBar");
    expect(page).not.toContain("MobileAnalyseOverview");
    expect(page).not.toContain("@/components/app/ios-mobile");
    expect(page).not.toContain("IOSGroupedList");
    expect(page).not.toContain("IOSInlineStatus");
    expect(page).not.toContain("lg:hidden");
    expect(page).not.toContain("hidden lg:");
  });

  it("keeps session comparison to one visible desktop evidence tree", () => {
    const page = source("src/app/(app)/analyse/compare/page.tsx");

    expect(page).toContain("<SessionComparisonToolbar");
    expect(page).toContain("<ComparisonProvenancePanel");
    expect(page).toContain("<SaveComparisonDialog");
    expect(page).toContain("<DeleteComparisonButton");
    expect(page).not.toContain("MobileSessionCompare");
    expect(page).not.toContain("MobileTopBar");
    expect(page).not.toContain("MobileFilterSheet");
    expect(page).not.toContain("BottomSheet");
    expect(page).not.toContain("@/components/app/ios-mobile");
    expect(page).not.toContain("lg:hidden");
    expect(page).not.toContain("hidden lg:");
  });

  it("keeps conditions as one desktop evidence tree", () => {
    const page = source("src/app/(app)/analyse/conditions/page.tsx");

    expect(page).toContain("<AnalysisPageTemplate");
    expect(page).toContain("<Table>");
    expect(page).not.toContain("MobileConditionsAnalysis");
    expect(page).not.toContain("MobileTopBar");
    expect(page).not.toContain("MobileFilterSheet");
    expect(page).not.toContain("@/components/app/ios-mobile");
    expect(page).not.toContain("lg:hidden");
    expect(page).not.toContain("hidden lg:");
  });

  it("keeps workspace operations in one desktop evidence tree", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");

    expect(page).toContain("<DataQualityInbox");
    expect(page).toContain("<AnnotationWorkspace");
    expect(page).toContain("<EquipmentImpactWorkspace");
    expect(page).toContain("<SnapshotWorkspace");
    expect(page).not.toContain("MobileAnalysisWorkspace");
    expect(page).not.toContain("BottomSheet");
    expect(page).not.toContain("@/components/app/ios-mobile");
    expect(page).not.toContain("lg:hidden");
    expect(page).not.toContain("hidden lg:");
  });

  it("preserves one desktop session-impact canvas and one reversible filter", () => {
    const page = source("src/app/(app)/analyse/session-impact/page.tsx");
    const client = source("src/app/analyse/session-impact/session-impact-client.tsx");

    expect(client.indexOf("What changes next")).toBeLessThan(client.indexOf("Reversible filter"));
    expect(client.match(/<LandingPathMap/g)?.length).toBe(1);
    expect(client).toContain("Top-down path estimate");
    expect(client).toContain("Reversible filter");
    expect(client).toContain("Before and after");
    expect(page).not.toContain("@/components/app/ios-mobile");
    expect(client).not.toContain("@/components/app/ios-mobile");
    expect(client).not.toContain("MobileFilterSheet");
    expect(page).not.toContain("lg:hidden");
    expect(page).not.toContain("hidden lg:");
    expect(client).not.toContain("lg:hidden");
    expect(client).not.toContain("hidden lg:");
  });
});
