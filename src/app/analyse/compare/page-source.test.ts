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
    expect(source).toContain('href="/practice"');
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
    expect(toolbarSource).toContain("Environment / conditions");
    expect(toolbarSource).toContain("<EntityCombobox");
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
    expect(source).toContain("<DeleteComparisonButton");
    expect(source).toContain("divide-y divide-border/70");
    expect(source).not.toContain("<StatusTimeline");
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
