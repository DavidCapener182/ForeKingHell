import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/analyse/compare/page.tsx"), "utf8");
const provenanceSource = readFileSync(
  join(process.cwd(), "src/app/analyse/compare/comparison-provenance-panel.tsx"),
  "utf8",
);

describe("session comparison page", () => {
  it("supports explicit focus/baseline sessions and keeps the existing compare path", () => {
    expect(source).toContain('focus: period ? "last-30" : "session"');
    expect(source).toContain('baseline: period ? "previous-30" : "previous-session"');
    expect(source).toContain('href="/compare"');
  });

  it("shows answer, confidence, next action and metric provenance", () => {
    expect(source).toContain("data.benefit.summary");
    expect(source).toContain("confidenceLabel");
    expect(source).toContain('href="/practice"');
    expect(source).toContain("ComparisonProvenancePanel");
    expect(provenanceSource).toContain("Method & provenance");
    expect(provenanceSource).toContain("metric.source");
    expect(provenanceSource).toContain("metric.method");
    expect(source).toContain('href="/shots"');
  });

  it("keeps one visible desktop evidence tree and preserves save/delete workflows", () => {
    expect(source).toContain("<SessionComparisonToolbar");
    expect(source).toContain("<Table>");
    expect(source).toContain("<SaveComparisonDialog");
    expect(source).toContain("<DeleteComparisonButton");
    expect(source).toContain("<StatusTimeline");
    for (const obsoleteMobileSource of [
      "MobileSessionCompare",
      "MobileAppShell",
      "MobileTopBar",
      "MobileFilterSheet",
      "BottomSheet",
      "@/components/app/ios-mobile",
      "lg:hidden",
      "hidden lg:",
    ]) {
      expect(source).not.toContain(obsoleteMobileSource);
    }
  });
});
