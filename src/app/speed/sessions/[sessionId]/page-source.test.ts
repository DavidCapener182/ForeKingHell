import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/speed/sessions/[sessionId]/page.tsx"),
  "utf8",
);

describe("speed session desktop swing log", () => {
  it("uses the shared desktop workbench shell without adding a contextual rail", () => {
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="speed-session">');
    expect(source).toContain("</DesktopWorkbenchLayout>");
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps individual swings in a desktop workbench table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('id="speed-session-swing-log"');
    expect(source).toContain('data-workbench-scope="speed-session-swings"');
    expect(source).toContain('data-workbench-export-table="speed-session-swings"');
    expect(source).toContain('mainTableLabel="Speed session swing log table"');
    expect(source).toContain('mainTableLabel="Speed session swing log table" stickyFirstColumn');
    expect(source).toContain("tabIndex={0}");
  });

  it("adds the fatigue evidence before the existing swing ledger", () => {
    expect(source).toContain(
      'import { SpeedFatigueChart } from "@/components/speed/speed-fatigue-chart"',
    );
    expect(source).toContain("readings={data.swings.map");
    expect(source).toContain("swingNumber: swing.swingNumber");
    expect(source).toContain("clubSpeedMph: swing.clubSpeedMph");

    const chartIndex = source.indexOf("<SpeedFatigueChart");
    const ledgerIndex = source.indexOf("<SwingLogWorkbench data={data} />");
    expect(chartIndex).toBeGreaterThan(-1);
    expect(ledgerIndex).toBeGreaterThan(chartIndex);
  });

  it("keeps the speed session detail page focused on data and editing", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("shows separate session metrics and preserves all three training phases", () => {
    for (const label of ["Median", "Top 3 average", "Top 5 average", "Session best"]) {
      expect(source).toContain(`label: "${label}"`);
    }

    expect(source).toContain('title="Warm-up"');
    expect(source).toContain('title="Maximum speed"');
    expect(source).toContain('title="Transfer"');
    expect(source).toContain('name="warmupReadings"');
    expect(source).toContain('name="speedReadings"');
    expect(source).toContain("const peakSummary = data.peakSwingSummary");
    expect(source).toContain('label="Warm-up median"');
  });

  it("links an explicit five-shot Driver transfer test with a concrete 4-of-5 rule", () => {
    expect(source).toContain("saveSpeedTransferTestAction");
    expect(source).toContain("at least 4 of 5 finish inside your personal corridor");
    expect(source).toContain('name="shotId"');
    expect(source).toContain("Choose the exact five normal Driver shots");
    expect(source).toContain("Shot {shot.shotNumber ?? index + 1}");
    expect(source).toContain("Link selected five");
    expect(source).toContain("speed_error?: string | string[]");
    expect(source).toContain('? "Failed"');
  });
});

describe("speed session desktop-only bundle", () => {
  it("excludes the obsolete companion and iOS render graph", () => {
    expect(source).toContain('<DesktopWorkbenchLayout scope="speed-session">');
    expect(source).toContain('className="grid gap-3"');

    for (const obsoleteSurface of [
      "MobileSpeedSessionAnswer",
      "MobileSpeedSessionDisclosures",
      "MobileSwingEvidence",
      "MobileSpeedSessionEditForm",
      "@/components/app/ios-mobile",
      "lg:hidden",
      "sm:hidden",
      "hidden lg:contents",
      'className="hidden gap-3 sm:grid"',
    ]) {
      expect(source).not.toContain(obsoleteSurface);
    }
  });

  it("keeps ordinary session cards and table cells theme-aware", () => {
    expect(source).toContain("bg-card");
    expect(source).toContain("var(--status-success-surface)");
    expect(source).not.toMatch(/\b(?:bg-white|text-slate-|border-slate-|bg-emerald-)/);
  });
});
