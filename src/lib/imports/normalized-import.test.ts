import { describe, expect, it } from "vitest";

import { parseLaunchMonitorImportCsv } from "@/lib/imports/normalized-import";

describe("parseLaunchMonitorImportCsv", () => {
  it("normalizes TrackMan rows into the existing import persistence shape", async () => {
    const parsed = await parseLaunchMonitorImportCsv({
      source: "trackman",
      fileName: "trackman-export.csv",
      rawCsvText:
        "Club,Carry,Total,Ball Speed,Club Speed,Launch Angle,Offline,Smash Factor,Spin Rate\nDriver,241.8,262.4,151.4,105.2,12.6,-18.5,1.44,2310",
      fallbackDistanceUnit: "yards",
    });

    expect(parsed).toMatchObject({
      source: "trackman",
      rowCount: 2,
      shotCount: 1,
      appliedDistanceUnit: "yards",
      headers: [
        "Club",
        "Carry",
        "Total",
        "Ball Speed",
        "Club Speed",
        "Launch Angle",
        "Offline",
        "Smash Factor",
        "Spin Rate",
      ],
    });
    expect(parsed.rawRows.map((row) => row.rowType)).toEqual(["header", "shot"]);
    expect(parsed.shots[0]).toMatchObject({
      rowNumber: 2,
      shotNumber: 1,
      clubType: "driver",
      clubLabel: "Driver",
      clubKey: "driver:generic:generic",
      carryYd: 241.8,
      totalYd: 262.4,
      ballSpeedMph: 151.4,
      clubSpeedMph: 105.2,
      launchAngleDeg: 12.6,
      sideCarryYd: -18.5,
      smashFactor: 1.44,
      spinRate: 2310,
    });
  });

  it("applies the same field-level total-distance quarantine to normalized providers", async () => {
    const parsed = await parseLaunchMonitorImportCsv({
      source: "trackman",
      fileName: "trackman-export.csv",
      rawCsvText: "Club,Carry,Total\n7 Iron,136.8,8.8",
      fallbackDistanceUnit: "yards",
    });

    expect(parsed.shots[0]).toMatchObject({
      carryYd: 136.8,
      totalYd: null,
      qualityTag: null,
      integrityIssues: [
        expect.objectContaining({ code: "total_below_carry", field: "totalYd", value: 8.8 }),
      ],
    });
    expect(parsed.shots[0].sourceRawJson.Total).toBe("8.8");
    expect(parsed.shots[0].warnings).toContain(
      "Row 2: total distance 8.8 yd is incompatible with carry distance 136.8 yd; only the total-distance field was quarantined.",
    );
    expect(parsed.warnings).toContain(
      "Row 2: total distance 8.8 yd is incompatible with carry distance 136.8 yd; only the total-distance field was quarantined.",
    );
  });
});
