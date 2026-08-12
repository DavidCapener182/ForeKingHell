import "server-only";

import { isPlaywrightE2eAuthBypassEnabled } from "@/lib/current-user";
import type { RapsodoClubChoice, RapsodoClubSuggestion } from "@/lib/rapsodo/club-inference";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";

export function rapsodoE2eFixtureEnabled() {
  return isPlaywrightE2eAuthBypassEnabled() && process.env.RAPSODO_E2E_FIXTURE === "1";
}

export function rapsodoE2eFixtureSessions(): RapsodoSessionListItem[] {
  return [
    fixtureSession("playwright-newest", "Playwright range session", "2026-08-12T18:00:00.000Z"),
    fixtureSession("playwright-older", "Previous range session", "2026-08-11T18:00:00.000Z"),
  ];
}

export function rapsodoE2eFixturePreview(
  session: RapsodoSessionListItem,
): RapsodoSessionPreview | null {
  if (session.providerSessionId !== "playwright-newest") return null;

  const driver = clubChoice("driver", "driver", "Driver");
  const sevenIron = clubChoice("7i", "7i", "7 Iron");
  const csvRows = [
    "Shot Number,Session ID,Club Type,Carry Distance (yd),Total Distance (yd),Ball Speed,Launch Angle,Apex (yd),Side Carry (yd)",
    ...Array.from({ length: 12 }, (_, index) =>
      [
        index + 1,
        "playwright-rcloud",
        "Driver",
        218 + (index % 6),
        235 + (index % 7),
        143 + (index % 4),
        12 + (index % 3) * 0.4,
        31 + (index % 4),
        -6 + index,
      ].join(","),
    ),
    ...Array.from({ length: 6 }, (_, index) =>
      [
        index + 13,
        "playwright-rcloud",
        "7 Iron",
        151 + (index % 4),
        158 + (index % 4),
        112 + (index % 3),
        17 + (index % 3) * 0.5,
        27 + (index % 3),
        -3 + index,
      ].join(","),
    ),
  ].join("\n");

  return {
    session,
    rawCsvText: csvRows,
    fileName: "playwright-rcloud-range.csv",
    fileSizeBytes: new TextEncoder().encode(csvRows).byteLength,
    rawCsvHash: "playwright-rcloud-fixture",
    distanceUnit: "yards",
    sessionType: "range",
    sessionDate: session.dateIso!,
    courseName: "",
    courseScorecard: [],
    courseScorecardSource: null,
    warnings: [],
    shotCount: 18,
    rawRowCount: 19,
    clubChoices: [driver, sevenIron],
    shots: [
      ...Array.from({ length: 12 }, (_, index) => ({
        rowNumber: index + 2,
        shotNumber: index + 1,
        reportedClubLabel: "Driver",
        reportedClubType: "driver",
        carryYd: 218 + (index % 6),
        totalYd: 235 + (index % 7),
        ballSpeedMph: 143 + (index % 4),
        launchAngleDeg: 12 + (index % 3) * 0.4,
        sideCarryYd: -6 + index,
        rapsodoShotId: null,
        reportedChoice: driver,
        suggestion: clubSuggestion(driver, "trusted"),
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        rowNumber: index + 14,
        shotNumber: index + 13,
        reportedClubLabel: "7 Iron",
        reportedClubType: "7i",
        carryYd: 151 + (index % 4),
        totalYd: 158 + (index % 4),
        ballSpeedMph: 112 + (index % 3),
        launchAngleDeg: 17 + (index % 3) * 0.5,
        sideCarryYd: -3 + index,
        rapsodoShotId: null,
        reportedChoice: sevenIron,
        suggestion: clubSuggestion(sevenIron, index === 0 ? "medium" : "trusted"),
      })),
    ],
  };
}

function fixtureSession(
  providerSessionId: string,
  title: string,
  dateIso: string,
): RapsodoSessionListItem {
  return {
    providerKind: "practice",
    providerSessionId,
    providerSessionType: "range",
    providerSessionMode: null,
    title,
    dateIso,
    shotCount: 18,
    courseName: null,
    importedSessionId: null,
    exportRawCsvHash: null,
    lastImportedAt: null,
    firstSeenAt: dateIso,
    lastSeenAt: dateIso,
    isNew: true,
  };
}

function clubChoice(clubKey: string, clubType: string, clubLabel: string): RapsodoClubChoice {
  return {
    clubKey,
    clubType,
    clubLabel,
    clubBrand: null,
    clubModel: null,
    active: true,
    stockCarryYd: null,
    stockTotalYd: null,
    averageBallSpeedMph: null,
    sampleSize: 0,
    rapsodoClubId: null,
  };
}

function clubSuggestion(
  choice: RapsodoClubChoice,
  confidence: RapsodoClubSuggestion["confidence"],
): RapsodoClubSuggestion {
  return {
    choice,
    confidence,
    confidenceScore: confidence === "trusted" ? 95 : 62,
    reason:
      confidence === "trusted"
        ? "Rapsodo's reported club is a trusted match."
        : "Confirm this one uncertain club match.",
    alternatives: [],
  };
}
