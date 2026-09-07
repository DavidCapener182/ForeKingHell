import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/analyse/compare/page.tsx"), "utf8");
const provenanceSource = readFileSync(
  join(process.cwd(), "src/app/analyse/compare/comparison-provenance-panel.tsx"),
  "utf8",
);
const toolbarSource = readFileSync(
  join(process.cwd(), "src/app/analyse/compare/session-comparison-toolbar.tsx"),
  "utf8",
);
const stageSource = readFileSync(
  join(process.cwd(), "src/app/analyse/compare/session-comparison-stage.tsx"),
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
    expect(source).toContain("href={practiceHref}");
    expect(source).toContain('data.filters.focus === "session"');
    expect(source).toContain('data.filters.condition === "same"');
    expect(source).toContain("data.focus.sessionBreakdown.length === 1");
    expect(source).toContain(
      'practiceQuery.set("sourceSessionId", data.focus.sessionBreakdown[0].id)',
    );
    expect(source).toContain("ComparisonProvenancePanel");
    expect(provenanceSource).toContain("Evidence & method");
    expect(provenanceSource).toContain("metric.source");
    expect(provenanceSource).toContain("metric.method");
    expect(source).toContain('href="/shots"');
  });

  it("uses one connected comparison setup and a large switchable visual stage", () => {
    expect(source).toContain("<SessionComparisonToolbar");
    expect(toolbarSource).toContain("Focus session");
    expect(toolbarSource).toContain("Baseline session");
    expect(toolbarSource).toContain("Environment and conditions");
    expect(toolbarSource).toContain("<ComparisonSearchSheet");
    expect(stageSource).toContain('value="overlay"');
    expect(stageSource).toContain('value="side-by-side"');
    expect(stageSource).toContain('value="delta"');
    expect(stageSource).toContain("Carry distribution");
    expect(stageSource).toContain("Direction");
    expect(stageSource).toContain("Confidence");
  });

  it("keeps one visible evidence tree and preserves compact save/delete workflows", () => {
    expect(source).toContain("<Table>");
    expect(source).toContain("<SaveComparisonDialog");
    expect(source).toContain("<SavedComparisons");
    const saved = readFileSync(
      join(process.cwd(), "src/app/analyse/compare/saved-comparisons.tsx"),
      "utf8",
    );
    expect(saved).toContain("<DeleteComparisonButton");
    expect(saved).toContain("divide-y overflow-y-auto");
    expect(source).not.toContain("<StatusTimeline");
    for (const obsoleteMobileSource of [
      "MobileSessionCompare",
      "MobileAppShell",
      "MobileTopBar",
      "MobileFilterSheet",
      "BottomSheet",
      "@/components/app/ios-mobile",
    ]) {
      expect(source).not.toContain(obsoleteMobileSource);
    }
  });
});
