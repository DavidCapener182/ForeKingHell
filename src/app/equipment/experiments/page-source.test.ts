import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/equipment/experiments/page.tsx"),
  "utf8",
);

describe("equipment experiment mobile composition", () => {
  it("leads with the measured verdict and moves setup and decision forms into sheets", () => {
    expect(source).toContain("MobileEquipmentExperiment");
    expect(source).toContain("experimentVerdict(metrics)");
    expect(source).toContain("experimentKeyMetrics(metrics)");
    expect(source).toContain("ExperimentSelectionSheet");
    expect(source).toContain("ExperimentDecisionSheet");
    expect(source).toContain('title="Choose measured setups"');
    expect(source).toContain('title="Record equipment decision"');
    expect(source).toContain("IOSDisclosureGroup");
  });

  it("keeps the desktop experiment workbench and real mutations intact", () => {
    expect(source).toContain("data-equipment-experiment-desktop");
    expect(source).toContain('className="hidden gap-4 lg:grid"');
    expect(source).toContain("getCompareData(filters)");
    expect(source).toContain("saveSessionComparisonAction");
    expect(source).toContain('action="/equipment/experiments"');
  });

  it("uses accessible native controls and honest confidence language", () => {
    expect(source).toContain("min-h-11");
    expect(source).toContain('role="alert"');
    expect(source).toContain("metrics[0]?.source");
    expect(source).toContain("metrics[0]?.caveat");
    expect(source).not.toContain("min-h-10");
  });
});
