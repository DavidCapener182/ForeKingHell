import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";
let loginCalls = 0,
  imported = false;
const session: RapsodoSessionListItem = {
  providerKind: "simulation",
  providerSessionId: "fixture-remote-1",
  providerSessionType: "course",
  providerSessionMode: "course",
  title: "Synthetic cloud course",
  dateIso: "2026-09-01T12:00:00Z",
  shotCount: 1,
  courseName: "Synthetic course",
  importedSessionId: null,
  exportRawCsvHash: null,
  lastImportedAt: null,
  firstSeenAt: null,
  lastSeenAt: null,
  isNew: false,
};
const choice = {
  clubKey: "fixture-7i",
  clubType: "7i",
  clubLabel: "Fixture 7 iron",
  clubBrand: null,
  clubModel: null,
  stockCarryYd: 150,
  stockTotalYd: 160,
  averageBallSpeedMph: 100,
  sampleSize: 12,
};
const preview: RapsodoSessionPreview = {
  session,
  rawCsvText: "synthetic",
  fileName: "fixture.csv",
  fileSizeBytes: 9,
  rawCsvHash: "synthetic-hash",
  distanceUnit: "yards",
  sessionType: "simulated_course",
  sessionDate: "2026-09-01",
  courseName: "Synthetic course",
  courseScorecard: [],
  courseScorecardSource: null,
  warnings: ["Synthetic provider fixture: no live account."],
  shotCount: 1,
  rawRowCount: 1,
  clubChoices: [choice],
  shots: [
    {
      rowNumber: 1,
      shotNumber: 1,
      reportedClubLabel: "7i",
      reportedClubType: "7i",
      carryYd: 150,
      totalYd: 160,
      ballSpeedMph: 100,
      launchAngleDeg: 18,
      sideCarryYd: -3,
      rapsodoShotId: "fixture-shot-1",
      reportedChoice: choice,
      suggestion: {
        choice,
        confidenceScore: 90,
        confidence: "high",
        reason: "Synthetic measured match",
        alternatives: [],
      },
    },
  ],
};
export async function loginRapsodoAction() {
  loginCalls++;
  return loginCalls === 1
    ? { ok: false, message: "Synthetic connection failure; retry.", code: "FIXTURE" }
    : { ok: true, data: { connected: true, profile: null } };
}
export async function disconnectRapsodoAction() {
  return { ok: true, data: { connected: false } };
}
export async function listRapsodoSessionsAction() {
  return { ok: true, data: [{ ...session, importedSessionId: imported ? "fixture-saved" : null }] };
}
export async function previewRapsodoSessionAction() {
  return { ok: true, data: preview };
}
export async function syncRapsodoShotClubsAction() {
  throw new Error("Provider writeback must not be used by this fixture");
}
export async function importRapsodoSessionAction(input: unknown) {
  document.documentElement.dataset.importInput = JSON.stringify(input);
  document.documentElement.dataset.importCalls = String(
    Number(document.documentElement.dataset.importCalls ?? 0) + 1,
  );
  imported = true;
  return {
    ok: true,
    data: {
      ok: true,
      sessionId: "fixture-saved",
      shotCount: 1,
      skipped: false,
      warnings: ["Saved receipt retained after metadata failure."],
      achievementUnlockNotifications: [],
    },
  };
}
