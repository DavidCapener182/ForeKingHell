import "server-only";

import { and, asc, desc, eq, or } from "drizzle-orm";

import {
  clubs,
  courseFeatures,
  courses,
  holes,
  sessions,
  shots,
  stockYardages,
  teeSets,
} from "@/db/schema";
import { getDb } from "@/db/client";
import {
  COURSE_TWIN_RUNTIME_VERSION,
  COURSE_TWIN_SCHEMA_VERSION,
  type CourseTwinFeature,
  type CourseTwinManifest,
  type CourseTwinPoint,
  type CourseTwinReplayDocument,
} from "@/lib/course-twin-contract";
import { courseTwinBoundsForPoints, createCourseTwinProjector } from "@/lib/course-twin-geometry";
import { buildCourseTwinReplay, type CourseTwinReplaySourceShot } from "@/lib/course-twin-replay";
import type { CourseTwinBagProfile } from "@/lib/course-twin-strategy";
import bootleTerrainPackage from "@/generated/course-twins/bootle-v3.json";

const PILOT_EXTERNAL_ID = "bootle-golf-course";

export function isCourseTwinFeatureEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_COURSE_TWIN !== "false";
}

export async function getCourseTwinManifest({
  userId,
  courseId,
}: {
  userId: string;
  courseId: string;
}): Promise<CourseTwinManifest | null> {
  if (!isCourseTwinFeatureEnabled()) return null;
  const db = getDb();
  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      country: courses.country,
      latitude: courses.latitude,
      longitude: courses.longitude,
      externalId: courses.externalId,
    })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
      ),
    )
    .limit(1);

  if (!course || course.externalId !== PILOT_EXTERNAL_ID) return null;

  const [holeRows, featureRows] = await Promise.all([
    db
      .select({
        teeSetId: holes.teeSetId,
        teeSetName: teeSets.name,
        holeNumber: holes.holeNumber,
        par: holes.par,
        yards: holes.yards,
        strokeIndex: holes.strokeIndex,
        teeLat: holes.teeLat,
        teeLng: holes.teeLng,
        greenLat: holes.greenLat,
        greenLng: holes.greenLng,
        centerlineGeojson: holes.centerlineGeojson,
      })
      .from(holes)
      .innerJoin(teeSets, eq(holes.teeSetId, teeSets.id))
      .where(eq(holes.courseId, courseId))
      .orderBy(asc(teeSets.name), asc(holes.holeNumber)),
    db
      .select({
        id: courseFeatures.id,
        holeNumber: courseFeatures.holeNumber,
        featureType: courseFeatures.featureType,
        geometryJson: courseFeatures.geometryJson,
        source: courseFeatures.source,
      })
      .from(courseFeatures)
      .where(eq(courseFeatures.courseId, courseId)),
  ]);

  const selectedTeeSetId = teeSetWithMostHoles(holeRows);
  const selectedHoles = holeRows.filter((hole) => hole.teeSetId === selectedTeeSetId);
  if (selectedHoles.length === 0) return null;

  const origin = {
    latitude: bootleTerrainPackage.origin.latitude,
    longitude: bootleTerrainPackage.origin.longitude,
  };
  const toLocal = createCourseTwinProjector(origin.latitude, origin.longitude);
  const manifestHoles = selectedHoles.map((hole) => {
    const projectedCenterline = hole.centerlineGeojson.coordinates.map(([lng, lat]) =>
      toLocal(lat, lng),
    );
    const centerline =
      projectedCenterline.length >= 2
        ? projectedCenterline
        : [toLocal(hole.teeLat, hole.teeLng), toLocal(hole.greenLat, hole.greenLng)];
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      yards: hole.yards,
      strokeIndex: hole.strokeIndex,
      tee: centerline[0],
      green: centerline.at(-1) ?? centerline[0],
      centerline,
    };
  });
  const savedFeatures = featureRows
    .map((feature) => featureToManifest(feature, toLocal))
    .filter((feature): feature is CourseTwinFeature => feature !== null);
  const packagedFeatures = bootleTerrainPackage.semanticFeatures
    .map((feature) => packagedFeatureToManifest(feature, toLocal))
    .filter((feature): feature is CourseTwinFeature => feature !== null);
  const manifestFeatures = [...savedFeatures, ...packagedFeatures];
  const points = [
    ...manifestHoles.flatMap((hole) => hole.centerline),
    ...manifestFeatures.flatMap((feature) => feature.rings.flat()),
  ];
  const mappedBounds = courseTwinBoundsForPoints(points);
  const bounds = {
    minX: Math.min(mappedBounds.minX, bootleTerrainPackage.heightmap.localBounds.minX),
    maxX: Math.max(mappedBounds.maxX, bootleTerrainPackage.heightmap.localBounds.maxX),
    minZ: Math.min(mappedBounds.minZ, bootleTerrainPackage.heightmap.localBounds.minZ),
    maxZ: Math.max(mappedBounds.maxZ, bootleTerrainPackage.heightmap.localBounds.maxZ),
  };
  const warnings = [
    `Terrain uses Environment Agency 1 m LiDAR downsampled to ${bootleTerrainPackage.packageResolutionM.toFixed(1)} m for browser delivery.`,
    "Greens and bunker edges are mapped references, not a putting-grade survey or manual course verification.",
  ];
  if (manifestFeatures.length === 0) {
    warnings.push("No semantic course feature polygons are currently saved for this course.");
  }

  return {
    schemaVersion: COURSE_TWIN_SCHEMA_VERSION,
    packageVersion: bootleTerrainPackage.packageVersion,
    minimumRuntimeVersion: COURSE_TWIN_RUNTIME_VERSION,
    course: { id: course.id, name: course.name, country: course.country },
    origin: {
      ...origin,
      elevationM: bootleTerrainPackage.origin.elevationM,
      coordinateSystem: "LOCAL_ENU_METRES",
    },
    bounds,
    terrain: {
      kind: "lidar_dtm",
      resolutionM: bootleTerrainPackage.packageResolutionM,
      verticalDatum: bootleTerrainPackage.verticalDatum,
      warning: warnings[0],
      heightmap: {
        ...bootleTerrainPackage.heightmap,
        encoding: "float32_le_relative_metres",
      },
      imagery: {
        ...bootleTerrainPackage.imagery,
        kind: "aerial_reference",
      },
    },
    quality: {
      grade: "B",
      mappedHoles: manifestHoles.length,
      expectedHoles: 18,
      mappedFeatures: manifestFeatures.length,
      verified: false,
      warnings,
    },
    supportedModes: ["flyover", "replay", "strategy", "play"],
    holes: manifestHoles,
    features: manifestFeatures,
    attribution: [
      {
        label: bootleTerrainPackage.source.label,
        url: bootleTerrainPackage.source.url,
        licence: bootleTerrainPackage.source.licence,
      },
      {
        label: bootleTerrainPackage.mapSource.label,
        url: bootleTerrainPackage.mapSource.url,
        licence: bootleTerrainPackage.mapSource.licence,
      },
      {
        label: bootleTerrainPackage.imagery.attribution,
        url: "https://www.esri.com/en-us/legal/terms/full-master-agreement",
        licence: "Esri World Imagery terms",
      },
    ],
  };
}

export async function getCourseTwinReplay({
  userId,
  courseId,
  sessionId,
  manifest,
}: {
  userId: string;
  courseId: string;
  sessionId?: string | null;
  manifest: CourseTwinManifest;
}): Promise<CourseTwinReplayDocument | null> {
  const db = getDb();
  const predicates = [eq(sessions.userId, userId), eq(sessions.courseId, courseId)];
  if (sessionId) predicates.push(eq(sessions.id, sessionId));

  const [session] = await db
    .select({
      id: sessions.id,
      date: sessions.date,
      source: sessions.source,
      courseName: sessions.courseName,
      fileName: sessions.fileName,
    })
    .from(sessions)
    .innerJoin(shots, and(eq(shots.sessionId, sessions.id), eq(shots.userId, userId)))
    .where(and(...predicates))
    .orderBy(desc(sessions.date))
    .limit(1);
  if (!session) return null;

  const shotRows: CourseTwinReplaySourceShot[] = await db
    .select({
      id: shots.id,
      courseHoleNumber: shots.courseHoleNumber,
      courseHoleShotNumber: shots.courseHoleShotNumber,
      shotNumber: shots.shotNumber,
      clubType: shots.clubType,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      apexFt: shots.apexFt,
      ballSpeedMph: shots.ballSpeedMph,
      launchAngleDeg: shots.launchAngleDeg,
      spinRate: shots.spinRate,
      spinAxis: shots.spinAxis,
      distanceRemainingYd: shots.distanceRemainingYd,
      courseHoleYards: shots.courseHoleYards,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.sessionId, session.id)))
    .orderBy(asc(shots.courseHoleNumber), asc(shots.courseHoleShotNumber), asc(shots.shotNumber));
  if (shotRows.length === 0) return null;

  return buildCourseTwinReplay({
    manifest,
    session: {
      id: session.id,
      title: session.courseName ?? session.fileName ?? manifest.course.name,
      date: session.date,
      source: session.source,
    },
    shots: shotRows,
  });
}

export async function getCourseTwinBagProfiles(userId: string): Promise<CourseTwinBagProfile[]> {
  const db = getDb();
  const [clubRows, stockRows, shotRows] = await Promise.all([
    db
      .select({ id: clubs.id, type: clubs.type })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true)))
      .orderBy(asc(clubs.bagPosition)),
    db
      .select({
        clubId: stockYardages.clubId,
        sampleSize: stockYardages.sampleSize,
        carryMedianYd: stockYardages.carryMedianYd,
        carryP25Yd: stockYardages.carryP25Yd,
        carryP75Yd: stockYardages.carryP75Yd,
        totalMedianYd: stockYardages.totalMedianYd,
        dispersionLeftYd: stockYardages.dispersionLeftYd,
        dispersionRightYd: stockYardages.dispersionRightYd,
        confidenceScore: stockYardages.confidenceScore,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .where(eq(stockYardages.userId, userId))
      .orderBy(desc(stockYardages.calculatedAt))
      .limit(240),
    db
      .select({
        clubId: shots.clubId,
        carryYd: shots.carryYd,
        sideCarryYd: shots.sideCarryYd,
        ballSpeedMph: shots.ballSpeedMph,
        launchAngleDeg: shots.launchAngleDeg,
        spinRate: shots.spinRate,
        shotCategory: shots.shotCategory,
        qualityTag: shots.qualityTag,
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .orderBy(desc(shots.shotAt))
      .limit(2_000),
  ]);
  const latestStockByClubId = new Map<string, (typeof stockRows)[number]>();
  for (const stock of stockRows) {
    if (!latestStockByClubId.has(stock.clubId)) latestStockByClubId.set(stock.clubId, stock);
  }

  return clubRows
    .map((club) => {
      const stock = latestStockByClubId.get(club.id);
      if (!stock || stock.carryMedianYd === null || stock.sampleSize < 1) return null;
      const measured = shotRows.filter(
        (shot) =>
          shot.clubId === club.id &&
          shot.shotCategory === "full" &&
          !shot.qualityTag?.toLowerCase().includes("exclude"),
      );
      const carries = numericValues(measured.map((shot) => shot.carryYd));
      const sides = numericValues(measured.map((shot) => shot.sideCarryYd));
      const speeds = numericValues(measured.map((shot) => shot.ballSpeedMph));
      const launches = numericValues(measured.map((shot) => shot.launchAngleDeg));
      const spins = numericValues(measured.map((shot) => shot.spinRate));
      const interquartileStdDev =
        stock.carryP25Yd !== null && stock.carryP75Yd !== null
          ? Math.abs(stock.carryP75Yd - stock.carryP25Yd) / 1.349
          : null;
      const storedSideSpread = Math.max(stock.dispersionLeftYd ?? 0, stock.dispersionRightYd ?? 0);
      return {
        clubId: club.id,
        clubType: club.type,
        sampleSize: stock.sampleSize,
        confidenceScore: stock.confidenceScore ?? 0,
        carryMedianYd: stock.carryMedianYd,
        carryStdDevYd: Math.max(2.5, interquartileStdDev ?? standardDeviation(carries) ?? 8),
        totalMedianYd: stock.totalMedianYd,
        sideMeanYd: mean(sides) ?? 0,
        sideStdDevYd: Math.max(2, (standardDeviation(sides) ?? storedSideSpread / 1.28) || 7),
        ballSpeedMeanMph: mean(speeds),
        ballSpeedStdDevMph: standardDeviation(speeds),
        launchMeanDeg: mean(launches),
        launchStdDevDeg: standardDeviation(launches),
        spinMeanRpm: mean(spins),
        spinStdDevRpm: standardDeviation(spins),
      } satisfies CourseTwinBagProfile;
    })
    .filter((profile): profile is CourseTwinBagProfile => profile !== null);
}

function teeSetWithMostHoles(rows: Array<{ teeSetId: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.teeSetId, (counts.get(row.teeSetId) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function numericValues(values: Array<number | null>) {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function standardDeviation(values: number[]) {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function featureToManifest(
  feature: {
    id: string;
    holeNumber: number | null;
    featureType: string;
    geometryJson: unknown;
    source: string;
  },
  toLocal: (latitude: number, longitude: number) => CourseTwinPoint,
): CourseTwinFeature | null {
  const allowedTypes = new Set<CourseTwinFeature["type"]>([
    "tee",
    "fairway",
    "green",
    "bunker",
    "water",
    "rough",
    "trees",
    "course_boundary",
  ]);
  if (!allowedTypes.has(feature.featureType as CourseTwinFeature["type"])) return null;
  const geometry = feature.geometryJson as {
    type?: string;
    coordinates?: unknown;
  };
  const polygonRings = geometry.type === "Polygon" ? geometry.coordinates : null;
  if (!Array.isArray(polygonRings)) return null;
  const rings = polygonRings
    .map((ring) =>
      Array.isArray(ring)
        ? ring
            .map((coordinate) =>
              Array.isArray(coordinate) &&
              typeof coordinate[0] === "number" &&
              typeof coordinate[1] === "number"
                ? toLocal(coordinate[1], coordinate[0])
                : null,
            )
            .filter((point): point is CourseTwinPoint => point !== null)
        : [],
    )
    .filter((ring) => ring.length >= 3);
  if (rings.length === 0) return null;
  return {
    id: feature.id,
    holeNumber: feature.holeNumber,
    type: feature.featureType as CourseTwinFeature["type"],
    rings,
    source: feature.source,
  };
}

function packagedFeatureToManifest(
  feature: {
    id: string;
    type: string;
    source: string;
    coordinates: number[][];
    tags: { ref: string | null };
  },
  toLocal: (latitude: number, longitude: number) => CourseTwinPoint,
): CourseTwinFeature | null {
  const allowedTypes = new Set<CourseTwinFeature["type"]>(["tee", "bunker", "water", "trees"]);
  if (!allowedTypes.has(feature.type as CourseTwinFeature["type"])) return null;
  const ring = feature.coordinates
    .map(([longitude, latitude]) =>
      Number.isFinite(latitude) && Number.isFinite(longitude) ? toLocal(latitude, longitude) : null,
    )
    .filter((point): point is CourseTwinPoint => point !== null);
  if (ring.length < 4) return null;
  const referencedHole = Number(feature.tags.ref);
  return {
    id: feature.id,
    holeNumber:
      Number.isInteger(referencedHole) && referencedHole >= 1 && referencedHole <= 18
        ? referencedHole
        : null,
    type: feature.type as CourseTwinFeature["type"],
    rings: [ring],
    source: feature.source,
  };
}
