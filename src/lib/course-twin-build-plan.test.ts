import { describe, expect, it } from "vitest";

import {
  assessCourseTwinQuality,
  buildCourseTwinPlan,
  selectTerrainAdapters,
} from "@/lib/course-twin-build-plan";

describe("Course Twin build planning", () => {
  it("selects Environment Agency LiDAR for an English course with a global fallback", () => {
    expect(selectTerrainAdapters("England", 53.48, -2.97)).toEqual({
      primary: "environment_agency_lidar",
      fallbacks: ["copernicus_glo30"],
      targetResolutionM: 1,
    });
  });

  it("selects the Welsh Government one-metre COG before the global fallback", () => {
    expect(selectTerrainAdapters("Wales", 51.6, -2.93)).toEqual({
      primary: "welsh_government_lidar",
      fallbacks: ["copernicus_glo30"],
      targetResolutionM: 1,
    });
    expect(selectTerrainAdapters("United Kingdom", 51.6, -2.93).primary).toBe(
      "welsh_government_lidar",
    );
  });

  it("selects national adapters and retains Copernicus for unsupported regions", () => {
    expect(selectTerrainAdapters("United States", 40, -75).primary).toBe("usgs_3dep");
    expect(selectTerrainAdapters("New Zealand", -43, 172).primary).toBe("linz_elevation");
    expect(selectTerrainAdapters("Canada", 49, -123).primary).toBe("nrcan_hrdem");
    expect(selectTerrainAdapters("Australia", -33, 151)).toEqual({
      primary: "copernicus_glo30",
      fallbacks: [],
      targetResolutionM: 30,
    });
  });

  it("keeps Grade A unavailable without verified putting contours", () => {
    const result = assessCourseTwinQuality({
      terrainResolutionM: 1,
      mappedHoles: 18,
      expectedHoles: 18,
      mappedGreens: 18,
      mappedFairways: 18,
      mappedBunkers: 30,
      scorecardVerified: true,
      puttingVerified: false,
    });
    expect(result.grade).toBe("B");
    expect(result.supportedModes).toContain("play");
    expect(result.warnings).toContain("Putting contours have not been survey-verified.");
  });

  it("limits coarse or incomplete courses to honest lower-grade uses", () => {
    const result = assessCourseTwinQuality({
      terrainResolutionM: 30,
      mappedHoles: 12,
      expectedHoles: 18,
      mappedGreens: 6,
      mappedFairways: 4,
      mappedBunkers: 0,
      scorecardVerified: false,
      puttingVerified: false,
    });
    expect(result.grade).toBe("C");
    expect(result.supportedModes).toEqual(["flyover", "replay", "strategy"]);
    expect(result.warnings[0]).toMatch(/not suitable/);
  });

  it("produces deterministic fingerprints and changes them when correction revision changes", () => {
    const input = {
      courseId: "course-1",
      courseName: "Bootle Golf Course",
      externalId: "Bootle Golf Course",
      country: "England",
      latitude: 53.48,
      longitude: -2.97,
      expectedHoles: 18,
      mappedHoles: 18,
      mappedFeatureCounts: { fairway: 18, green: 18, bunker: 24 },
      scorecardVerified: false,
      courseUpdatedAt: "2026-07-22T00:00:00.000Z",
      correctionRevision: null,
      sourceGeometry: { holes: [], features: [] },
    };
    const first = buildCourseTwinPlan(input);
    const second = buildCourseTwinPlan({ ...input });
    const corrected = buildCourseTwinPlan({ ...input, correctionRevision: "revision-2" });
    expect(first.inputFingerprint).toBe(second.inputFingerprint);
    expect(corrected.inputFingerprint).not.toBe(first.inputFingerprint);
    expect(first.packageKeyPrefix).toBe("bootle-golf-course-");
    expect(first.course).toMatchObject({
      id: "course-1",
      name: "Bootle Golf Course",
      origin: { latitude: 53.48, longitude: -2.97 },
    });
    expect(first.course.geographicBounds.minLatitude).toBeLessThan(53.48);
    expect(first.course.geographicBounds.maxLongitude).toBeGreaterThan(-2.97);
  });
});
