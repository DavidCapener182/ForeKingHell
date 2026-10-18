import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPerformanceIntelligence, type PerformanceShot } from "@/lib/performance-intelligence";
import { ClubPerformanceIntelligence } from "./club-performance-intelligence";

// Synthetic fixtures, never used as live player evidence.
const shots: PerformanceShot[] = Array.from({ length: 32 }, (_, index) => ({
  id: `synthetic-${index}`,
  sessionId: index < 30 ? "historical" : "recent",
  shotAt: index < 30 ? "2026-01-01" : "2026-10-15",
  carryYd: index < 30 ? 220 : index === 30 ? 180 : 40,
  sideCarryYd: index === 30 ? -12 : 12,
  shotCategory: "full",
  qualityTag: index === 31 ? "severe-mishit" : null,
  source: "synthetic-monitor",
  equipmentId: "fixture-driver",
  settingsKey: "raw",
  ballType: "fixture-ball",
  environment: "range",
  normalization: "raw",
}));
const intelligence = buildPerformanceIntelligence(shots, { asOf: new Date("2026-10-18") });

describe("performance intelligence rendering", () => {
  it("keeps selected potential, stock and actual all-attempt evidence distinct", () => {
    const html = renderToStaticMarkup(
      <ClubPerformanceIntelligence intelligence={intelligence} clubType="driver" mode="current" />,
    );
    expect(html).toContain("220.0");
    expect(html).toContain("180.0");
    expect(html).toContain("2 valid intended attempts");
    expect(html).toContain("1 stock shots");
    expect(html).toContain("Actual carry distribution");
    expect(html).toContain("genuine mishits");
    expect(html).toContain("Explicit severe mishit");
    expect(html).toContain("Provisional");
    expect(html).toContain("No comparable sessions");
    expect(html).not.toContain("Bag average");
  });
  it("keeps benchmark mode first with the selected-average target and metric-specific level", () => {
    const html = renderToStaticMarkup(
      <ClubPerformanceIntelligence intelligence={intelligence} clubType="driver" />,
    );
    expect(html).toContain('data-state="active"');
    for (const text of [
      "Benchmarks",
      "Current form",
      "Coaching",
      "Selected potential",
      "carry band",
      "selected average",
      "Each shot does not need to exceed",
    ])
      expect(html).toContain(text);
    expect(html).toContain("lmwt-legacy-v1");
  });
  it("provides deterministic coaching, evidence and next actions without AI", () => {
    const html = renderToStaticMarkup(
      <ClubPerformanceIntelligence intelligence={intelligence} clubType="driver" mode="coaching" />,
    );
    for (const text of [
      "Success criterion",
      "Retest",
      "Evidence confidence",
      "Build practice",
      "View supporting shots",
      "Speed development",
      "Rules-based explanation",
    ])
      expect(html).toContain(text);
    expect(html).toContain('href="/speed"');
  });
  it("discloses unknown context and unavailable evidence without fabricated values", () => {
    const empty = buildPerformanceIntelligence([], { asOf: new Date("2026-10-18") });
    const html = renderToStaticMarkup(<ClubPerformanceIntelligence intelligence={empty} />);
    expect(html).toContain("No eligible performance evidence");
    expect(html).not.toContain("220");
  });
});
