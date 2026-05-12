import { describe, expect, it } from "vitest";

import { parseOfflineImportPayload } from "@/lib/offline-import-payload";

describe("offline import payload parser", () => {
  it("accepts queued Rapsodo import payloads", () => {
    const payload = parseOfflineImportPayload({
      inputs: [
        {
          rawCsvText: "Club,Carry\n7i,150",
          fileName: "range.csv",
          fileSizeBytes: 24,
          source: "rapsodo",
          sessionType: "range",
          sessionDate: "2026-05-12",
          distanceUnit: "yards",
          columnMapping: {
            clubType: "Stick",
            carryDistance: "Flight Metres",
            ignoredField: "Nope",
          },
          courseHoleScoring: [
            {
              holeNumber: 1,
              csvShotCount: 3,
              putts: 2,
              penalties: null,
              score: 5,
              netScore: null,
              fairwayHit: true,
              gir: false,
              strokeIndex: 8,
            },
          ],
        },
      ],
    });

    expect(payload?.inputs).toHaveLength(1);
    expect(payload?.inputs[0]?.sessionType).toBe("range");
    expect(payload?.inputs[0]?.columnMapping).toEqual({
      clubType: "Stick",
      carryDistance: "Flight Metres",
    });
    expect(payload?.inputs[0]?.courseHoleScoring?.[0]?.fairwayHit).toBe(true);
  });

  it("rejects missing CSV text or unsupported session types", () => {
    expect(
      parseOfflineImportPayload({
        inputs: [
          {
            fileName: "range.csv",
            fileSizeBytes: 24,
            source: "rapsodo",
            sessionType: "practice",
            sessionDate: "2026-05-12",
            distanceUnit: "yards",
          },
        ],
      }),
    ).toBeNull();
  });
});
