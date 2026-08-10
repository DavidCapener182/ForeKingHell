import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function componentBody(page: string, name: string, nextName: string) {
  const start = page.indexOf(`function ${name}`);
  const end = page.indexOf(`function ${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return page.slice(start, end);
}

describe("Analyse native mobile information architecture", () => {
  it("keeps the hub answer and action visible before routing secondary questions", () => {
    const page = source("src/app/(app)/analyse/page.tsx");
    const mobile = componentBody(page, "MobileAnalyseOverview", "getAnalyseOverview");

    expect(mobile.indexOf("Primary insight")).toBeLessThan(mobile.indexOf("Choose a question"));
    expect(mobile).toContain("Evidence coverage");
    expect(mobile).toContain("Evidence tools");
    expect(mobile).toContain("IOSGroupedList");
    expect(page).toContain("AnalysisPageTemplate");
  });

  it("puts the comparison verdict ahead of its filter sheet and discloses provenance per metric", () => {
    const page = source("src/app/(app)/analyse/compare/page.tsx");
    const mobile = componentBody(page, "MobileSessionCompare", "SessionSelect");

    expect(mobile.indexOf("data.benefit.summary")).toBeLessThan(
      mobile.indexOf("MobileFilterSheet"),
    );
    expect(mobile).toContain('label="Comparison metric evidence"');
    expect(mobile).toContain("metric.source");
    expect(mobile).toContain("metric.method");
    expect(mobile).toContain("BottomSheet");
  });

  it("replaces mobile condition tables with one-level disclosure rows while preserving desktop tables", () => {
    const page = source("src/app/(app)/analyse/conditions/page.tsx");
    const mobile = componentBody(page, "MobileConditionsAnalysis", "getConditionsData");

    expect(mobile.indexOf("Largest recorded difference")).toBeLessThan(
      mobile.indexOf("Recorded conditions"),
    );
    expect(mobile).toContain('label="Recorded condition breakdowns"');
    expect(mobile).toContain("MobileFilterSheet");
    expect(mobile).not.toContain("<Table");
    expect(page).toContain("<Table>");
  });

  it("keeps data repair visible and moves secondary workspace operations into one disclosure level", () => {
    const page = source("src/app/(app)/analyse/workspace/page.tsx");
    const mobile = componentBody(page, "MobileAnalysisWorkspace", "MobileAnnotationWorkspace");

    expect(mobile.indexOf("Data-quality inbox")).toBeLessThan(
      mobile.indexOf("Evidence operations"),
    );
    expect(mobile).toContain('label="Analysis workspace operations"');
    expect(mobile).toContain("MobileAnnotationWorkspace");
    expect(page.match(/<BottomSheet/g)?.length).toBeGreaterThanOrEqual(2);
    expect(page).toContain("<DataQualityInbox");
  });

  it("preserves one specialist session-impact canvas and gives its surrounding controls mobile disclosure", () => {
    const client = source("src/app/analyse/session-impact/session-impact-client.tsx");

    expect(client.indexOf("What changes next")).toBeLessThan(
      client.indexOf("Change evidence filter"),
    );
    expect(client).toContain('label="Before and after metrics"');
    expect(client).toContain("MobileFilterSheet");
    expect(client.match(/<LandingPathMap/g)?.length).toBe(1);
    expect(client).toContain("Top-down path estimate");
  });
});
