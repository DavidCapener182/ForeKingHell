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
    expect(source).toContain("AnalyseDestinationList");
    expect(source).not.toContain("AnalysisRoute");

    for (const href of ["/progress", "/analyse/compare", "/shots", "/bag", "/coach"]) {
      expect(source).toContain(`href: "${href}"`);
    }
    expect(source).toContain('href="/practice"');

    expect(source).toContain("analysisConfidence({");
    expect(source).toContain("Test session impact");
    expect(source).toContain("Open analysis workspace");
    expect(source).toContain('href: "/analyse/workspace"');
  });
});
