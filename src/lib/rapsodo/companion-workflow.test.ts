import { describe, expect, it } from "vitest";

import type { RapsodoClubChoice, RapsodoClubSuggestion } from "@/lib/rapsodo/club-inference";
import {
  buildCompanionRapsodoShotOverrides,
  companionRapsodoInbox,
  companionRapsodoResultHref,
  uncertainCompanionRapsodoShots,
} from "@/lib/rapsodo/companion-workflow";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";

describe("mocked R-Cloud companion journey", () => {
  it("loads the newest unimported session, asks only for uncertain clubs, and redirects to the common result", () => {
    const imported = session("imported", "2026-08-12T10:00:00.000Z", "saved-session");
    const newest = session("newest", "2026-08-12T09:00:00.000Z");
    const older = session("older", "2026-08-11T09:00:00.000Z");

    expect(
      companionRapsodoInbox([older, imported, newest]).map((item) => item.providerSessionId),
    ).toEqual(["newest", "older"]);

    const driver = choice("driver", "driver", "Driver");
    const sevenIron = choice("7i", "7i", "7 Iron");
    const preview = {
      session: newest,
      rawCsvText: "fixture",
      fileName: "newest.csv",
      fileSizeBytes: 7,
      rawCsvHash: "hash",
      distanceUnit: "yards",
      sessionType: "range",
      sessionDate: newest.dateIso!,
      courseName: "",
      courseScorecard: [],
      courseScorecardSource: null,
      warnings: [],
      shotCount: 2,
      rawRowCount: 3,
      clubChoices: [driver, sevenIron],
      shots: [shot(1, suggestion(driver, "trusted")), shot(2, suggestion(driver, "low"))],
    } satisfies RapsodoSessionPreview;

    expect(uncertainCompanionRapsodoShots(preview).map((item) => item.rowNumber)).toEqual([2]);
    expect(buildCompanionRapsodoShotOverrides(preview, { 2: sevenIron.clubKey })).toEqual([
      expect.objectContaining({ rowNumber: 1, clubType: "driver" }),
      expect.objectContaining({ rowNumber: 2, clubType: "7i" }),
    ]);
    expect(companionRapsodoResultHref("saved session")).toBe(
      "/import/result?sessionId=saved%20session",
    );
    expect(companionRapsodoResultHref("saved session")).not.toContain("/shots");
  });
});

function session(
  id: string,
  dateIso: string,
  importedSessionId: string | null = null,
): RapsodoSessionListItem {
  return {
    providerKind: "practice",
    providerSessionId: id,
    providerSessionType: "range",
    providerSessionMode: null,
    title: id,
    dateIso,
    shotCount: 2,
    courseName: null,
    importedSessionId,
    exportRawCsvHash: null,
    lastImportedAt: null,
    firstSeenAt: dateIso,
    lastSeenAt: dateIso,
    isNew: true,
  };
}

function choice(clubKey: string, clubType: string, clubLabel: string): RapsodoClubChoice {
  return {
    clubKey,
    clubType,
    clubLabel,
    clubBrand: null,
    clubModel: null,
    stockCarryYd: null,
    stockTotalYd: null,
    averageBallSpeedMph: null,
    sampleSize: 0,
  };
}

function suggestion(
  selected: RapsodoClubChoice,
  confidence: RapsodoClubSuggestion["confidence"],
): RapsodoClubSuggestion {
  return {
    choice: selected,
    confidence,
    confidenceScore: confidence === "trusted" ? 95 : 30,
    reason: confidence === "trusted" ? "Reported club matched." : "Confirm this club.",
    alternatives: [],
  };
}

function shot(rowNumber: number, selected: RapsodoClubSuggestion) {
  return {
    rowNumber,
    shotNumber: rowNumber,
    reportedClubLabel: "Driver",
    reportedClubType: "driver",
    carryYd: 220,
    totalYd: 235,
    ballSpeedMph: 145,
    launchAngleDeg: 13,
    sideCarryYd: 4,
    rapsodoShotId: null,
    reportedChoice: selected.choice,
    suggestion: selected,
  };
}
