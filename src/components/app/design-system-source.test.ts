import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("composable analysis design primitives", () => {
  it("uses one accessible segmented control in analysis and map surfaces", () => {
    const segmented = source("src/components/app/segmented-control.tsx");
    const impact = source("src/app/analyse/session-impact/session-impact-client.tsx");
    const map = source("src/components/maps/shot-pattern-map.tsx");

    expect(segmented).toContain('role="group"');
    expect(segmented).toContain("aria-pressed");
    expect(segmented).toContain("min-h-11");
    expect(impact).toContain("@/components/app/segmented-control");
    expect(map).toContain("@/components/app/segmented-control");
    expect(impact).not.toContain("function SegmentedControl(");
    expect(map).not.toContain("function SegmentedControl(");
  });

  it("provides focused confidence, health, offline, session and club primitives", () => {
    const evidence = source("src/components/app/evidence-status.tsx");
    const offline = source("src/components/app/offline-state.tsx");
    const rows = source("src/components/app/analysis-rows.tsx");

    expect(evidence).toContain("export function ConfidenceIndicator");
    expect(evidence).toContain("export function DataHealthStatus");
    expect(evidence).toContain('role="status"');
    expect(offline).toContain("export function OfflineState");
    expect(offline).toContain('aria-live="polite"');
    expect(rows).toContain("export function SessionSummary");
    expect(rows).toContain("export function ClubRow");
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
});
