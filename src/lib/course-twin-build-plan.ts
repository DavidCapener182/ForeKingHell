import { createHash } from "node:crypto";

import type { CourseTwinMode } from "@/lib/course-twin-contract";

export type CourseTwinTerrainAdapter =
  | "environment_agency_lidar"
  | "welsh_government_lidar"
  | "usgs_3dep"
  | "linz_elevation"
  | "nrcan_hrdem"
  | "copernicus_glo30";

export type CourseTwinBuildInput = {
  courseId: string;
  courseName: string;
  externalId: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  expectedHoles: number;
  mappedHoles: number;
  mappedFeatureCounts: Partial<
    Record<"fairway" | "green" | "bunker" | "water" | "tee" | "trees", number>
  >;
  scorecardVerified: boolean;
  courseUpdatedAt: string;
  correctionRevision: string | null;
  sourceGeometry: {
    holes: Array<{
      holeNumber: number;
      par: number;
      yards: number;
      strokeIndex: number | null;
      tee: [longitude: number, latitude: number];
      green: [longitude: number, latitude: number];
      centerline: Array<[longitude: number, latitude: number]>;
    }>;
    features: Array<{
      id: string;
      holeNumber: number | null;
      featureType: string;
      geometry: unknown;
      source: string;
    }>;
  };
};

export type CourseTwinBuildPlan = {
  schemaVersion: 1;
  inputFingerprint: string;
  packageKeyPrefix: string;
  course: {
    id: string;
    name: string;
    country: string | null;
    origin: { latitude: number; longitude: number };
    geographicBounds: {
      minLatitude: number;
      maxLatitude: number;
      minLongitude: number;
      maxLongitude: number;
    };
  };
  terrain: {
    primary: CourseTwinTerrainAdapter;
    fallbacks: CourseTwinTerrainAdapter[];
    targetResolutionM: number;
  };
  mapSources: ["openstreetmap", "overture"];
  sourceGeometry: CourseTwinBuildInput["sourceGeometry"];
  quality: CourseTwinQualityAssessment;
};

export type CourseTwinQualityAssessment = {
  grade: "A" | "B" | "C" | "D";
  score: number;
  supportedModes: CourseTwinMode[];
  suitableUse: string;
  warnings: string[];
  evidence: {
    terrainResolutionM: number;
    holeCoverage: number;
    greenCoverage: number;
    fairwayCoverage: number;
    scorecardVerified: boolean;
    puttingVerified: boolean;
  };
};

export function buildCourseTwinPlan(input: CourseTwinBuildInput): CourseTwinBuildPlan {
  validateBuildInput(input);
  const terrain = selectTerrainAdapters(input.country, input.latitude, input.longitude);
  const geographicBounds = courseBounds(input.latitude, input.longitude);
  const quality = assessCourseTwinQuality({
    terrainResolutionM: terrain.targetResolutionM,
    mappedHoles: input.mappedHoles,
    expectedHoles: input.expectedHoles,
    mappedGreens: input.mappedFeatureCounts.green ?? 0,
    mappedFairways: input.mappedFeatureCounts.fairway ?? 0,
    mappedBunkers: input.mappedFeatureCounts.bunker ?? 0,
    scorecardVerified: input.scorecardVerified,
    puttingVerified: false,
  });
  const canonicalInput = stableJson({ ...input, terrain, schemaVersion: 1 });
  return {
    schemaVersion: 1,
    inputFingerprint: createHash("sha256").update(canonicalInput).digest("hex"),
    packageKeyPrefix: `${safeSlug(input.externalId ?? input.courseId)}-`,
    course: {
      id: input.courseId,
      name: input.courseName.trim(),
      country: input.country,
      origin: { latitude: input.latitude, longitude: input.longitude },
      geographicBounds,
    },
    terrain,
    mapSources: ["openstreetmap", "overture"],
    sourceGeometry: input.sourceGeometry,
    quality,
  };
}

export function selectTerrainAdapters(
  country: string | null,
  latitude: number,
  longitude: number,
): CourseTwinBuildPlan["terrain"] {
  const normalised = country?.trim().toLowerCase() ?? "";
  if (isWales(normalised, latitude, longitude)) {
    return {
      primary: "welsh_government_lidar",
      fallbacks: ["copernicus_glo30"],
      targetResolutionM: 1,
    };
  }
  if (isEngland(normalised, latitude, longitude)) {
    return {
      primary: "environment_agency_lidar",
      fallbacks: ["copernicus_glo30"],
      targetResolutionM: 1,
    };
  }
  if (normalised.includes("united states") || normalised === "usa" || normalised === "us") {
    return { primary: "usgs_3dep", fallbacks: ["copernicus_glo30"], targetResolutionM: 1 };
  }
  if (normalised.includes("new zealand") || normalised === "nz") {
    return { primary: "linz_elevation", fallbacks: ["copernicus_glo30"], targetResolutionM: 1 };
  }
  if (normalised.includes("canada")) {
    return { primary: "nrcan_hrdem", fallbacks: ["copernicus_glo30"], targetResolutionM: 2 };
  }
  return { primary: "copernicus_glo30", fallbacks: [], targetResolutionM: 30 };
}

export function assessCourseTwinQuality(input: {
  terrainResolutionM: number;
  mappedHoles: number;
  expectedHoles: number;
  mappedGreens: number;
  mappedFairways: number;
  mappedBunkers: number;
  scorecardVerified: boolean;
  puttingVerified: boolean;
}): CourseTwinQualityAssessment {
  const expected = Math.max(1, input.expectedHoles);
  const holeCoverage = clamp01(input.mappedHoles / expected);
  const greenCoverage = clamp01(input.mappedGreens / expected);
  const fairwayCoverage = clamp01(input.mappedFairways / expected);
  const terrainScore =
    input.terrainResolutionM <= 1
      ? 32
      : input.terrainResolutionM <= 5
        ? 25
        : input.terrainResolutionM <= 10
          ? 15
          : input.terrainResolutionM <= 30
            ? 8
            : 0;
  const score = Math.round(
    terrainScore +
      holeCoverage * 23 +
      greenCoverage * 15 +
      fairwayCoverage * 15 +
      (input.scorecardVerified ? 10 : 0) +
      (input.puttingVerified ? 5 : 0),
  );

  const grade =
    score >= 90 && input.terrainResolutionM <= 1 && input.puttingVerified
      ? "A"
      : score >= 68 && input.terrainResolutionM <= 5 && holeCoverage >= 0.9
        ? "B"
        : score >= 28 && holeCoverage >= 0.5
          ? "C"
          : "D";
  const supportedModes: CourseTwinMode[] =
    grade === "A"
      ? ["flyover", "replay", "strategy", "play", "live", "explore"]
      : grade === "B"
        ? ["flyover", "replay", "strategy", "play", "live", "explore"]
        : grade === "C"
          ? ["flyover", "replay", "strategy"]
          : [];
  const warnings: string[] = [];
  if (input.terrainResolutionM > 5) {
    warnings.push("Terrain resolution is not suitable for reliable bunker lips or green breaks.");
  }
  if (greenCoverage < 0.9) warnings.push("Some greens are missing mapped polygons.");
  if (fairwayCoverage < 0.9) warnings.push("Some fairways are missing mapped polygons.");
  if (!input.scorecardVerified)
    warnings.push("Scorecard and tee data have not been manually verified.");
  if (!input.puttingVerified) warnings.push("Putting contours have not been survey-verified.");

  return {
    grade,
    score,
    supportedModes,
    suitableUse:
      grade === "A"
        ? "Full play including verified putting"
        : grade === "B"
          ? "Full shots with approximate greens"
          : grade === "C"
            ? "Strategy, flyover and visual replay"
            : "2D course view until more source data is available",
    warnings,
    evidence: {
      terrainResolutionM: input.terrainResolutionM,
      holeCoverage,
      greenCoverage,
      fairwayCoverage,
      scorecardVerified: input.scorecardVerified,
      puttingVerified: input.puttingVerified,
    },
  };
}

function isEngland(country: string, latitude: number, longitude: number) {
  if (country.includes("england")) return true;
  if (!country.includes("united kingdom") && country !== "uk" && country !== "gb") return false;
  return latitude >= 49.8 && latitude <= 55.9 && longitude >= -6.5 && longitude <= 2;
}

function isWales(country: string, latitude: number, longitude: number) {
  if (country.includes("wales")) return true;
  if (!country.includes("united kingdom") && country !== "uk" && country !== "gb") return false;
  return latitude >= 51.25 && latitude <= 53.5 && longitude >= -5.55 && longitude <= -2.55;
}

function validateBuildInput(input: CourseTwinBuildInput) {
  if (!input.courseId) throw new Error("courseId is required.");
  if (!input.courseName.trim()) throw new Error("courseName is required.");
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error("Course latitude is invalid.");
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("Course longitude is invalid.");
  }
  if (
    !Number.isInteger(input.expectedHoles) ||
    input.expectedHoles < 1 ||
    input.expectedHoles > 54
  ) {
    throw new Error("Expected hole count is invalid.");
  }
}

function courseBounds(latitude: number, longitude: number) {
  const halfHeightM = 1_100;
  const halfWidthM = 1_100;
  const latitudeDelta = halfHeightM / 111_320;
  const longitudeScale = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const longitudeDelta = halfWidthM / (111_320 * longitudeScale);
  return {
    minLatitude: latitude - latitudeDelta,
    maxLatitude: latitude + latitudeDelta,
    minLongitude: longitude - longitudeDelta,
    maxLongitude: longitude + longitudeDelta,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "course"
  );
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
