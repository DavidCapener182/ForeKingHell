import { describe, expect, it } from "vitest";

import { applyRapsodoShotOverridesForImport } from "@/lib/imports/save-rapsodo-import";
import {
  analyzeRapsodoCsvColumns,
  buildClubKey,
  normalizeClubType,
  parseRapsodoCsv,
} from "@/lib/rapsodo/parser";

describe("parseRapsodoCsv", () => {
  it("parses Rapsodo rows and preserves raw row data", () => {
    const csv = [
      "Shot Number,Club Type,Club Brand,Club Model,Carry Distance (m),Total Distance (m),Ball Speed,Launch Angle,Launch Direction,Apex (m),Side Carry (m),Club Speed,Smash Factor,Descent Angle,Attack Angle,Club Path,Club Data Est Type",
      "1,Driver,TaylorMade,Qi10,205,225,142.4,13.2,1.5,31,-8,98,1.45,38,-1.2,2.1,Measured",
    ].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.detectedDistanceUnit).toBe("meters");
    expect(result.appliedDistanceUnit).toBe("meters");
    expect(result.exportedAtIso).toBeNull();
    expect(result.shotCount).toBe(1);
    expect(result.shots[0]).toMatchObject({
      shotNumber: 1,
      clubType: "driver",
      clubLabel: "Driver",
      clubBrand: "TaylorMade",
      clubModel: "Qi10",
      carryYd: 224.191,
      totalYd: 246.063,
      ballSpeedMph: 142.4,
      launchAngleDeg: 13.2,
      launchDirectionDeg: 1.5,
      apexFt: 101.706,
      sideCarryYd: -8.749,
      clubSpeedMph: 98,
      smashFactor: 1.45,
      descentAngleDeg: 38,
      attackAngleDeg: -1.2,
      clubPathDeg: 2.1,
      clubDataEstType: "Measured",
    });
    expect(result.shots[0].sourceRawJson["Club Type"]).toBe("Driver");
  });

  it("skips the MLM2PRO preamble row and extracts the session date", () => {
    const csv = [
      '"Rapsodo MLM2PRO: David Capener - 04/24/2026 1:19 PM",,,,,,,,,,,,,,,',
      "",
      '"Club Type","Club Brand","Club Model","Carry Distance","Total Distance","Ball Speed","Launch Angle","Launch Direction","Apex","Side Carry","Club Speed","Smash Factor","Descent Angle","Attack Angle","Club Path","Club Data Est Type"',
      '"d","TaylorMade","Qi4D Max","183.8","195.8","123.9","13.8","14.1","73.2","64.3","86.8","1.43","37.2","-1.0","-1.0",1',
      '"Average",,,"183.8","195.8","123.9","13.8","14.1","73.2","64.3","86.8","1.43","37.2","-1.0","-1.0",1',
      '"Std. Dev.",,,"0","0","0","0","0","0","0","0","0","0","0","0",0',
    ].join("\n");

    const result = parseRapsodoCsv(csv, { fallbackDistanceUnit: "yards" });

    expect(result.sessionTitle).toBe("Rapsodo MLM2PRO: David Capener - 04/24/2026 1:19 PM");
    expect(result.exportedAtIso).toBe("2026-04-24T13:19:00.000Z");
    expect(result.rowCount).toBe(5);
    expect(result.shotCount).toBe(1);
    expect(result.rawRows.map((row) => row.rowType)).toEqual([
      "preamble",
      "header",
      "shot",
      "summary",
      "summary",
    ]);
    expect(result.shots[0].clubType).toBe("driver");
    expect(result.shots[0].carryYd).toBe(183.8);
    expect(result.shots[0].totalYd).toBe(195.8);
    expect(result.shots[0].sideCarryYd).toBe(64.3);
    expect(result.shots[0].apexFt).toBe(73.2);
  });

  it("keeps yards as yards and converts apex yards to feet", () => {
    const csv = [
      "Club Type,Carry Distance (yd),Total Distance (yd),Apex (yd),Side Carry (yd)",
      "8 Iron,150,160,30,-10",
    ].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.detectedDistanceUnit).toBe("yards");
    expect(result.shots[0].clubType).toBe("8i");
    expect(result.shots[0].carryYd).toBe(150);
    expect(result.shots[0].totalYd).toBe(160);
    expect(result.shots[0].apexFt).toBe(90);
    expect(result.shots[0].sideCarryYd).toBe(-10);
  });

  it("uses fallback meters when headers do not expose a distance unit", () => {
    const csv = ["Club Type,Carry Distance,Total Distance", "5W,170,188"].join("\n");

    const result = parseRapsodoCsv(csv, { fallbackDistanceUnit: "meters" });

    expect(result.detectedDistanceUnit).toBe("unknown");
    expect(result.appliedDistanceUnit).toBe("meters");
    expect(result.shots[0].carryYd).toBeCloseTo(185.914, 3);
    expect(result.warnings).toEqual([]);
  });

  it("defaults unknown distance units to yards", () => {
    const csv = ["Club Type,Carry Distance,Total Distance", "5W,170,188"].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.detectedDistanceUnit).toBe("unknown");
    expect(result.appliedDistanceUnit).toBe("yards");
    expect(result.shots[0].carryYd).toBe(170);
  });

  it("handles blank numeric values as null", () => {
    const csv = [
      "Club Type,Carry Distance (m),Total Distance (m),Ball Speed,Launch Angle",
      "9i,,126,,--",
    ].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.shots[0].carryYd).toBeNull();
    expect(result.shots[0].ballSpeedMph).toBeNull();
    expect(result.shots[0].launchAngleDeg).toBeNull();
    expect(result.shots[0].totalYd).toBeCloseTo(137.795, 3);
  });

  it("uses a manual column mapping when Rapsodo changes header names", () => {
    const csv = ["Club Used,Carry Metres,Ball Velocity,Start Direction", "7 Iron,140,109,-2.5"].join("\n");

    const result = parseRapsodoCsv(csv, {
      fallbackDistanceUnit: "meters",
      columnMapping: {
        clubType: "Club Used",
        carryDistance: "Carry Metres",
        ballSpeed: "Ball Velocity",
        launchDirection: "Start Direction",
      },
    });

    expect(result.shotCount).toBe(1);
    expect(result.shots[0]).toMatchObject({
      clubType: "7i",
      carryYd: 153.106,
      ballSpeedMph: 109,
      launchDirectionDeg: -2.5,
    });
  });
});

describe("club normalization", () => {
  it("identifies common club types", () => {
    expect(normalizeClubType("5 Wood")).toBe("5w");
    expect(normalizeClubType("8 Iron")).toBe("8i");
    expect(normalizeClubType("Pitching Wedge")).toBe("pw");
    expect(normalizeClubType("Sand Wedge")).toBe("sw");
    expect(normalizeClubType("Ot")).toBe("other");
    expect(normalizeClubType("Other")).toBe("other");
  });

  it("builds stable club keys from type, brand, and model", () => {
    expect(buildClubKey("5w", "TaylorMade", "Qi10 Tour")).toBe("5w:taylormade:qi10tour");
    expect(buildClubKey("driver", null, "")).toBe("driver:generic:generic");
  });
});

describe("Rapsodo parser edge cases", () => {
  it("detects headers when a useful launch metric exists without carry distance", () => {
    const csv = ["Club Type,Total Distance (yd),Ball Speed,Launch Angle", "7 Iron,156,112,18.5"].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.shotCount).toBe(1);
    expect(result.shots[0]).toMatchObject({ clubType: "7i", totalYd: 156, ballSpeedMph: 112 });
  });

  it("preserves duplicate column names with stable suffixes", () => {
    const csv = ["Club Type,Carry Distance,Carry Distance,Total Distance", "Driver,220,221,240"].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.shots[0].sourceRawJson["Carry Distance"]).toBe("220");
    expect(result.shots[0].sourceRawJson["Carry Distance (2)"]).toBe("221");
  });

  it("warns on malformed quoted CSV", () => {
    const csv = ['Club Type,Carry Distance', 'Driver,"220'].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.warnings).toContain("CSV contains an unterminated quoted field; parsed results may be incomplete.");
  });

  it("warns that ambiguous slash dates are interpreted as US month/day/year", () => {
    const csv = [
      '"Rapsodo MLM2PRO: Player - 04/05/2026 8:00 AM"',
      "Club Type,Carry Distance",
      "PW,100",
    ].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.exportedAtIso).toBe("2026-04-05T08:00:00.000Z");
    expect(result.warnings).toContain("Export date is ambiguous; slash dates are interpreted as US month/day/year.");
  });

  it("keeps extreme side-carry values rather than dropping the shot", () => {
    const csv = ["Club Type,Carry Distance (yd),Side Carry (yd)", "Driver,250,-175"].join("\n");

    const result = parseRapsodoCsv(csv);

    expect(result.shotCount).toBe(1);
    expect(result.shots[0].sideCarryYd).toBe(-175);
  });

  it("finds likely headers and suggests manual mappings for unknown column names", () => {
    const csv = [
      '"Rapsodo MLM2PRO: Player - 04/05/2026 8:00 AM"',
      "Stick,Flight Metres,Ball Velocity",
      "Driver,220,145",
    ].join("\n");

    const analysis = analyzeRapsodoCsvColumns(csv);

    expect(analysis.headerRowNumber).toBe(2);
    expect(analysis.headers).toEqual(["Stick", "Flight Metres", "Ball Velocity"]);
    expect(analysis.needsManualMapping).toBe(true);
    expect(analysis.suggestedMapping).toMatchObject({
      clubType: "Stick",
      carryDistance: "Flight Metres",
      ballSpeed: "Ball Velocity",
    });
  });
});

describe("Rapsodo import shot overrides", () => {
  it("applies confirmed clubs by CSV row number while preserving the raw Rapsodo row", () => {
    const parsed = parseRapsodoCsv(
      [
        "Shot Number,Club Type,Club Brand,Club Model,Carry Distance (yd),Total Distance (yd)",
        "1,Other,,,151,162",
        "2,Driver,TaylorMade,Qi10,238,260",
      ].join("\n"),
    );

    const overridden = applyRapsodoShotOverridesForImport(parsed.shots, [
      {
        rowNumber: parsed.shots[0].rowNumber,
        clubType: "7 Iron",
        clubBrand: "Mizuno",
        clubModel: "JPX 923",
        qualityTag: "mishit",
      },
    ]);

    expect(overridden[0]).toMatchObject({
      rowNumber: parsed.shots[0].rowNumber,
      clubType: "7i",
      clubLabel: "7i",
      clubBrand: "Mizuno",
      clubModel: "JPX 923",
      clubKey: "7i:mizuno:jpx923",
      qualityTag: "mishit",
    });
    expect(overridden[0].sourceRawJson["Club Type"]).toBe("Other");
    expect(overridden[1]).toBe(parsed.shots[1]);
  });
});
