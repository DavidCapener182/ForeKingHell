import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";

vi.mock("@/app/rapsodo/actions", () => ({ importRapsodoSessionAction: vi.fn() }));
vi.mock("@/components/ui/drawer", () => {
  const Block = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Drawer: Block,
    DrawerContent: Block,
    DrawerDescription: Block,
    DrawerHeader: Block,
    DrawerTitle: Block,
  };
});
import { RapsodoCompanionPreview } from "./rapsodo-companion-preview";

function preview(confidence: "trusted" | "high" | "medium" | "low"): RapsodoSessionPreview {
  const choice = {
    clubKey: "7i:fixture",
    clubType: "7i",
    clubLabel: "7 Iron",
    clubBrand: null,
    clubModel: null,
    stockCarryYd: null,
    stockTotalYd: null,
    averageBallSpeedMph: null,
    sampleSize: 0,
  };
  return {
    session: {
      providerKind: "practice",
      providerSessionId: "synthetic",
      providerSessionType: null,
      providerSessionMode: null,
      title: "Synthetic session",
      dateIso: null,
      shotCount: 1,
      courseName: null,
      importedSessionId: null,
      exportRawCsvHash: null,
      lastImportedAt: null,
      firstSeenAt: null,
      lastSeenAt: null,
      isNew: false,
    },
    rawCsvText: "",
    fileName: "synthetic.csv",
    fileSizeBytes: 0,
    rawCsvHash: "synthetic",
    distanceUnit: "yards",
    sessionType: "range",
    sessionDate: "2026-10-18",
    courseName: "",
    courseScorecard: [],
    courseScorecardSource: null,
    warnings: [],
    shotCount: 1,
    rawRowCount: 1,
    clubChoices: [choice],
    shots: [
      {
        rowNumber: 1,
        shotNumber: 1,
        reportedClubLabel: confidence === "trusted" ? "7 Iron" : "Unknown",
        reportedClubType: confidence === "trusted" ? "7i" : "unknown",
        carryYd: 140,
        totalYd: 145,
        ballSpeedMph: 100,
        launchAngleDeg: 18,
        sideCarryYd: 4,
        rapsodoShotId: null,
        reportedChoice: confidence === "trusted" ? choice : null,
        suggestion: {
          choice,
          confidence,
          confidenceScore: 90,
          reason: "Synthetic suggestion",
          alternatives: [],
        },
      },
    ],
  };
}
function render(confidence: "trusted" | "high" | "medium" | "low") {
  return renderToStaticMarkup(
    <RapsodoCompanionPreview
      preview={preview(confidence)}
      practicePlanId={null}
      hydrated
      message={null}
      onMessageChange={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}
describe("companion import confirmation gate", () => {
  it.each(["high", "medium", "low"] as const)(
    "does not accept a %s confidence suggestion as explicit confirmation",
    (confidence) => {
      const html = render(confidence);
      expect(html).toContain("Confirm the suggested clubs above before importing");
      expect(html).toContain('aria-label="Confirm 7 Iron for shot 1"');
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Import 1 shot and review<\/button>/);
    },
  );
  it("lets an unchanged trusted source assignment continue without forcing a correction", () => {
    const html = render("trusted");
    expect(html).not.toContain("Confirm the suggested clubs above before importing");
    expect(html).toContain("Included clubs retain their source assignments");
    expect(html.match(/<button[^>]*>Import 1 shot and review<\/button>/)?.[0]).not.toContain(
      'disabled=""',
    );
  });
});
