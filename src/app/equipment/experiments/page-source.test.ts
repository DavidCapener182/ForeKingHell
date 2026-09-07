import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/equipment/experiments/page.tsx"),
  "utf8",
);

describe("equipment experiment desktop workbench", () => {
  it("excludes the obsolete companion graph from the desktop-only route bundle", () => {
    expect(source).toContain("data-equipment-experiment-desktop");
    for (const obsolete of [
      "MobileEquipmentExperiment",
      "ExperimentSelectionSheet",
      "ExperimentDecisionSheet",
      "IOSDisclosureGroup",
      "MobileAppShell",
      "lg:hidden",
      'className="hidden gap-4 lg:grid"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });

  it("keeps the desktop experiment workbench and real mutations intact", () => {
    expect(source).toContain("data-equipment-experiment-desktop");
    expect(source).toContain('className="grid gap-4"');
    expect(source).toContain("getCompareData(filters)");
    expect(source).toContain("action={saveSessionComparisonWithStateAction}");
    expect(source).toContain('name="baselineSessionId" value={data.filters.baselineSessionId}');
    expect(source).toContain('name="sessionId" value={data.filters.sessionId}');
    expect(source).toContain(
      "Your recorded judgement, separate from calculated sample confidence.",
    );
    expect(source).toContain("<ExperimentSelection");
    expect(source).toContain("initialBaseline={filters.baselineSessionId}");
    const selection = readFileSync(
      join(process.cwd(), "src/app/equipment/experiments/experiment-selection.tsx"),
      "utf8",
    );
    expect(selection).toContain('action="/equipment/experiments"');
  });

  it("uses accessible native controls and honest confidence language", () => {
    expect(source).toContain("min-h-11");
    expect(source).toContain(
      'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"',
    );
    expect(source).toContain("<AlertTitle>Check whether the test is fair</AlertTitle>");
    expect(source).toContain("<AlertDescription>");
    expect(source).not.toContain('role="alert"');
    expect(source).toContain("metric.confidenceLabel");
    expect(source).toContain("metric.caveat");
    expect(source).not.toContain("min-h-10");
  });
});
