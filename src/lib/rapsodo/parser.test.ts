import { describe, expect, it } from "vitest";

import {
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
