import { describe, expect, it } from "vitest";

import {
  selectIndependentMeasuredSpeedReadings,
  summarizeTrustedSpeedPb,
  type SpeedPbReading,
} from "@/lib/speed-training-data";

describe("trusted speed personal best evidence", () => {
  it("keeps estimated, unknown, and duplicate rows out of measured current-speed inputs", () => {
    const duplicateSource = { shot: "1", speed: "91" };
    const rows = [
      reading("measured", "one", 91, "0", duplicateSource),
      reading("duplicate", "two", 91, "0", duplicateSource),
      reading("estimated", "three", 95, "1", { shot: "2", speed: "95" }),
      reading("unknown", "four", 97.9, "8", { shot: "3", speed: "97.9" }),
    ];

    expect(selectIndependentMeasuredSpeedReadings(rows).map((row) => row.id)).toEqual(["measured"]);
  });

  it("does not treat duplicate imports of one physical 97.9 mph reading as repetition", () => {
    const duplicatedSource = {
      Date: "2026-05-01",
      "Shot Number": "41",
      "Club Speed": "97.9",
      "Ball Speed": "124.9",
    };

    const summary = summarizeTrustedSpeedPb([
      reading("cloud-97.9", "cloud-session", 97.9, "0", duplicatedSource),
      reading("csv-97.9", "csv-session", 97.9, "0", duplicatedSource),
      reading("measured-95.7", "older-session", 95.7, "0", {
        "Shot Number": "12",
        "Club Speed": "95.7",
      }),
      reading("measured-95.1", "older-session", 95.1, "Measured", {
        "Shot Number": "8",
        "Club Speed": "95.1",
      }),
    ]);

    expect(summary).toEqual({
      trustedPbMph: 95.7,
      trustedEvidenceCount: 2,
      independentReadingCount: 3,
      ignoredDuplicateCount: 1,
      unverifiedPeak: {
        mph: 97.9,
        reason: "one_off",
        independentEvidenceCount: 1,
        duplicateImportCount: 1,
      },
    });
  });

  it("keeps an unknown type-8 97.9 mph peak unverified even when it was imported twice", () => {
    const duplicatedSource = {
      Date: "2026-05-01",
      "Shot Number": "41",
      "Club Data Est Type": "8",
      "Club Speed": "97.9",
    };

    const summary = summarizeTrustedSpeedPb([
      reading("cloud-97.9", "cloud-session", 97.9, "8", duplicatedSource),
      reading("csv-97.9", "csv-session", 97.9, "8", duplicatedSource),
      reading("measured-95.7", "measured-session", 95.7, "0", {
        "Shot Number": "12",
        "Club Speed": "95.7",
      }),
      reading("measured-95.1", "measured-session", 95.1, "0", {
        "Shot Number": "8",
        "Club Speed": "95.1",
      }),
    ]);

    expect(summary.trustedPbMph).toBe(95.7);
    expect(summary.unverifiedPeak).toEqual({
      mph: 97.9,
      reason: "unknown_club_data",
      independentEvidenceCount: 1,
      duplicateImportCount: 1,
    });
  });

  it("does not promote the live 95.7 spike when its nearby row is estimated", () => {
    const summary = summarizeTrustedSpeedPb([
      reading("unknown-97.9", "may-session", 97.9, "8", { shot: "41", speed: "97.9" }),
      reading("measured-95.7", "april-session", 95.7, "0", { shot: "4", speed: "95.7" }),
      reading("estimated-95.1", "may-session", 95.1, "1", { shot: "19", speed: "95.1" }),
      reading("measured-94.6", "may-session", 94.6, "0", { shot: "16", speed: "94.6" }),
      reading("repeat-92.9-a", "march-a", 92.9, "0", { shot: "1", speed: "92.9" }),
      reading("repeat-92.9-b", "march-b", 92.9, "0", { shot: "2", speed: "92.9" }),
      reading("repeat-92.4", "march-c", 92.4, "0", { shot: "3", speed: "92.4" }),
    ]);

    expect(summary.trustedPbMph).toBe(92.9);
    expect(summary.unverifiedPeak).toMatchObject({
      mph: 97.9,
      reason: "unknown_club_data",
    });
  });

  it("promotes a measured peak after an independent near-peak reading corroborates it", () => {
    const summary = summarizeTrustedSpeedPb([
      reading("first-97.9", "session-one", 97.9, "0", {
        "Shot Number": "4",
        "Club Speed": "97.9",
      }),
      reading("repeat-97.4", "session-two", 97.4, "Measured", {
        "Shot Number": "17",
        "Club Speed": "97.4",
      }),
    ]);

    expect(summary).toMatchObject({
      trustedPbMph: 97.9,
      trustedEvidenceCount: 2,
      independentReadingCount: 2,
      ignoredDuplicateCount: 0,
      unverifiedPeak: null,
    });
  });

  it("allows a credible measured 95.7 mph peak when a separate 95.1 reading supports it", () => {
    const summary = summarizeTrustedSpeedPb([
      reading("peak", "session-one", 95.7, "0", {
        "Shot Number": "6",
        "Club Speed": "95.7",
      }),
      reading("support", "session-one", 95.1, "false", {
        "Shot Number": "7",
        "Club Speed": "95.1",
      }),
      reading("ordinary", "session-one", 89, "0", {
        "Shot Number": "8",
        "Club Speed": "89.0",
      }),
    ]);

    expect(summary.trustedPbMph).toBe(95.7);
    expect(summary.trustedEvidenceCount).toBe(2);
    expect(summary.unverifiedPeak).toBeNull();
  });

  it.each([
    ["1", "estimated_club_data"],
    ["Estimated", "estimated_club_data"],
    [null, "unknown_club_data"],
    ["8", "unknown_club_data"],
  ] as const)("does not let club-data type %s create a trusted PB", (clubDataEstType, reason) => {
    const summary = summarizeTrustedSpeedPb([
      reading("untrusted-peak", "session-one", 98, clubDataEstType, {
        "Shot Number": "1",
        "Club Speed": "98.0",
      }),
      reading("measured-peak", "session-one", 94.5, "0", {
        "Shot Number": "2",
        "Club Speed": "94.5",
      }),
      reading("measured-repeat", "session-two", 94, "0", {
        "Shot Number": "3",
        "Club Speed": "94.0",
      }),
    ]);

    expect(summary.trustedPbMph).toBe(94.5);
    expect(summary.unverifiedPeak).toMatchObject({ mph: 98, reason });
  });
});

function reading(
  id: string,
  sessionId: string,
  clubSpeedMph: number,
  clubDataEstType: string | null,
  sourceRawJson: Record<string, string>,
): SpeedPbReading {
  return {
    id,
    sessionId,
    shotAt: new Date("2026-05-01T10:00:00.000Z"),
    clubSpeedMph,
    clubDataEstType,
    sourceRawJson,
  };
}
