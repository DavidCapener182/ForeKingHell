import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/sessions/[sessionId]/page.tsx"),
  "utf8",
);

describe("session performance report hierarchy", () => {
  it("leads desktop with the verdict and makes dispersion the principal stage", () => {
    expect(source).toContain("data-session-performance-report");
    expect(source).toContain("data-session-verdict");
    expect(source).toContain("data-primary-dispersion-stage");
    expect(source).toContain('layout="desktop"');
    expect(source.indexOf("<DesktopVerdictHeader")).toBeLessThan(
      source.indexOf("data-primary-dispersion-stage"),
    );
  });

  it("orders interpretation, metrics, linked plan, club summary and collapsed evidence", () => {
    expect(source.indexOf("<WhatHappened")).toBeLessThan(
      source.indexOf('aria-labelledby="important-numbers-title"'),
    );
    expect(source.indexOf("<PlanVersusActual")).toBeLessThan(source.indexOf("<ClubSummary"));
    expect(source.indexOf("<ClubSummary")).toBeLessThan(source.indexOf("<EvidenceDisclosure"));
    expect(source).toContain('<details className="group');
    expect(source).not.toContain("defaultOpen");
  });

  it("keeps the mobile composition focused on the requested seven outcomes", () => {
    const mobile = source.match(/<MobileAppShell[\s\S]*?<\/MobileAppShell>/)?.[0] ?? "";
    expect(mobile).toContain("<ResultHero");
    expect(mobile).toContain("data-mobile-primary-chart");
    expect(mobile).toContain("<MobileMetricStory");
    expect(mobile).toContain('label="What improved"');
    expect(mobile).toContain('label="What needs work"');
    expect(mobile).toContain("Build next plan");
    expect(mobile).not.toContain("<PlanVersusActual");
    expect(mobile).not.toContain("<ClubSummary");
    expect(mobile).not.toContain("<EvidenceDisclosure");
  });
});
