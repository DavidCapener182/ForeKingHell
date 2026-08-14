import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("composable analysis design primitives", () => {
  it("uses one shadcn ToggleGroup-backed segmented control in analysis and map surfaces", () => {
    const segmented = source("src/components/app/segmented-control.tsx");
    const impact = source("src/app/analyse/session-impact/session-impact-client.tsx");
    const map = source("src/components/maps/shot-pattern-map.tsx");

    expect(segmented).toContain('from "@/components/ui/toggle-group"');
    expect(segmented).toContain('<ToggleGroup\n        type="single"');
    expect(segmented).toContain("<ToggleGroupItem");
    expect(segmented).toContain("min-h-11");
    expect(segmented).not.toContain("<button");
    expect(impact).toContain("@/components/app/segmented-control");
    expect(map).toContain("@/components/app/segmented-control");
    expect(impact).not.toContain("function SegmentedControl(");
    expect(impact).toContain('<ToggleGroup\n              type="single"');
    expect(impact).not.toContain("<button");
    expect(map).not.toContain("function SegmentedControl(");
  });

  it("provides focused confidence, health, offline, session and club primitives", () => {
    const evidence = source("src/components/app/evidence-status.tsx");
    const offline = source("src/components/app/offline-state.tsx");
    const rows = source("src/components/app/analysis-rows.tsx");

    expect(evidence).toContain("export function ConfidenceIndicator");
    expect(evidence).toContain("export function DataHealthStatus");
    expect(evidence).toContain("export function MetricEvidenceDrawer");
    expect(evidence).toContain("export function AnswerCard");
    expect(evidence).toContain("export function RecommendedAction");
    expect(evidence).toContain("export function DataWarning");
    expect(evidence).toContain('role="status"');
    expect(offline).toContain("export function OfflineState");
    expect(offline).toContain('aria-live="polite"');
    expect(rows).toContain("export function SessionSummary");
    expect(rows).toContain("export function ClubRow");
  });

  it("keeps chart metadata, comparisons, exports and data tables in one shared card", () => {
    const chartCard = source("src/components/app/chart-card.tsx");

    for (const primitive of [
      "sampleSize",
      "dateRange",
      "sourceLabel",
      "confidence",
      "comparisonToggle",
      "exportAction",
      "dataTable",
      "emptyState",
    ]) {
      expect(chartCard).toContain(primitive);
    }
  });

  it("uses one answer-first analytics workspace with evidence and a next action", () => {
    const template = source("src/components/app/analysis-page-template.tsx");
    const analyse = source("src/app/(app)/analyse/page.tsx");

    expect(template).toContain("data-analysis-page-template");
    expect(template).toContain('aria-label="Answer and evidence quality"');
    expect(template).toContain("recommendation");
    expect(analyse).toContain('aria-label="Analyse workspace"');
    expect(analyse).toContain('["Overview", "/analyse"]');
    expect(analyse).toContain("<ConnectedMetricBar");
    expect(analyse).toContain("<AnalyseProvenancePanel");
  });

  it("supports flat connected metrics inside an existing Card", () => {
    const metrics = source("src/components/app/connected-metric-bar.tsx");
    const nestedCallers = [
      source("src/app/(app)/goals/page.tsx"),
      source("src/app/(app)/providers/page.tsx"),
      source("src/app/rapsodo/rapsodo-sync-client.tsx"),
    ];

    expect(metrics).toContain("embedded = false");
    expect(metrics).toContain("data-connected-metric-bar-embedded");
    expect(metrics).toContain('embedded ? "rounded-lg border border-border shadow-none"');
    for (const caller of nestedCallers) {
      expect(caller).toMatch(/<ConnectedMetricBar\n\s+embedded/);
    }
  });

  it("keeps app shells full-width and centralises semantic surface tokens", () => {
    const premium = source("src/components/premium.tsx");
    const globals = source("src/app/globals.css");

    expect(premium).toContain('"!max-w-none"');
    for (const token of [
      "--surface:",
      "--surface-soft:",
      "--surface-border:",
      "--chart-1:",
      "--destructive:",
      "--radius:",
    ]) {
      expect(globals).toContain(token);
    }
  });

  it("keeps inactive tabs above the normal-text contrast threshold", () => {
    const tabs = source("src/components/ui/tabs.tsx");

    expect(tabs).toContain("text-foreground/70");
    expect(tabs).not.toContain("text-foreground/60");
  });
});
