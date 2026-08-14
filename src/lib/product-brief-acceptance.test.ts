import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { mobilePrimaryItems } from "@/components/app/nav-items";
import { appRouteMetadata } from "@/components/app/route-metadata";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("product brief acceptance", () => {
  it("keeps the consolidated desktop and five-destination mobile navigation", () => {
    expect(new Set(appRouteMetadata.map((route) => route.navigationGroup))).toEqual(
      new Set(["Home", "Play", "Analyse", "Improve", "Compete", "Account", "Admin"]),
    );
    expect(mobilePrimaryItems.map((item) => item.label)).toEqual([
      "Today",
      "Practice",
      "Play",
      "Sessions",
      "More",
    ]);
  });

  it("ships every improvement-loop route named by the brief", () => {
    for (const path of [
      "src/app/(app)/analyse/compare/page.tsx",
      "src/app/(app)/analyse/conditions/page.tsx",
      "src/app/(app)/analyse/workspace/page.tsx",
      "src/app/(app)/equipment/experiments/page.tsx",
      "src/app/(app)/goals/page.tsx",
      "src/app/(app)/practice/quick-range/page.tsx",
      "src/app/(app)/coach/workspace/page.tsx",
      "src/app/(app)/coach/reports/page.tsx",
      "src/app/(app)/courses/strategy/page.tsx",
      "src/app/(app)/settings/notifications/page.tsx",
      "src/app/share/report/[token]/page.tsx",
    ]) {
      expect(existsSync(join(process.cwd(), path)), path).toBe(true);
    }
  });

  it("keeps all four functional presentation modes and their accessibility behavior", () => {
    const themes = source("src/lib/theme.ts");
    const css = source("src/app/globals.css");
    for (const theme of ["outdoor", "range-night", "tour-broadcast", "high-contrast"]) {
      expect(themes).toContain(theme);
      expect(css).toContain(`data-theme="${theme}"`);
    }
    expect(css).toContain("3px solid");
    expect(css).toContain("text-decoration");
    expect(css).toContain("stroke-dasharray");
  });

  it("uses the shared accessible chart system in the action cockpit", () => {
    const chart = source("src/components/app/chart-card.tsx");
    const chartSurface = source("src/components/app/chart-surface.tsx");
    const fallback = source("src/components/app/chart-accessible-fallback.tsx");
    const todayCharts = source("src/app/today/today-shot-charts.tsx");
    expect(chart).toContain('data-chart-system="forekinghell"');
    expect(chartSurface).toContain("export function ChartSurface");
    expect(chartSurface).toContain('data-chart-system="forekinghell"');
    expect(fallback).toContain("Export CSV");
    expect(todayCharts).toContain("<ChartSurface");
    expect(todayCharts).toContain("50% ellipse");
    expect(todayCharts).toContain("80% ellipse");
    expect(todayCharts).toContain("Hide outliers");
    expect(todayCharts).toContain("tabIndex={0}");
  });

  it("keeps deterministic weekly, post-round and seasonal competition workflows", () => {
    const progress = source("src/app/(app)/progress/page.tsx");
    const courseStrategy = source(
      "src/app/(app)/courses/strategy/course-strategy-workbench-page.tsx",
    );
    const challenges = source("src/app/(app)/challenges/page.tsx");
    for (const field of [
      "Sessions and rounds",
      "Largest improvement",
      "Largest decline",
      "Practice completed",
      "Data-quality issues",
      "New personal bests",
      "One next action",
    ]) {
      expect(progress).toContain(field);
    }
    expect(progress).toContain("data-weekly-evidence-strip");
    for (const field of [
      "What felt different?",
      "Which club caused trouble?",
      "Did equipment or weather change?",
      "Which shots should be reviewed?",
      "Strongest club",
      "Most costly club",
      "Biggest difference",
      "Practice recommendation",
    ]) {
      expect(courseStrategy).toContain(field);
    }
    for (const component of [
      "ChallengeTabs",
      "ActiveChallengeGrid",
      "AvailableChallengeGrid",
      "CompletedChallengeGrid",
      "challengeImageSrc",
    ]) {
      expect(challenges).toContain(component);
    }
  });
});
