import "server-only";

import { and, asc, desc, eq, or } from "drizzle-orm";

import { courseFeatures, courses, holes, sessions, shots, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  COURSE_TWIN_RUNTIME_VERSION,
  COURSE_TWIN_SCHEMA_VERSION,
  type CourseTwinFeature,
  type CourseTwinManifest,
  type CourseTwinPoint,
  type CourseTwinReplayDocument,
} from "@/lib/course-twin-contract";
import {
  averageCourseTwinCoordinate,
  courseTwinBoundsForPoints,
  createCourseTwinProjector,
} from "@/lib/course-twin-geometry";
import { buildCourseTwinReplay, type CourseTwinReplaySourceShot } from "@/lib/course-twin-replay";

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
    latitude:
      course.latitude ?? averageCourseTwinCoordinate(selectedHoles.map((hole) => hole.teeLat)),
    longitude:
      course.longitude ?? averageCourseTwinCoordinate(selectedHoles.map((hole) => hole.teeLng)),
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
  const manifestFeatures = featureRows
    .map((feature) => featureToManifest(feature, toLocal))
    .filter((feature): feature is CourseTwinFeature => feature !== null);
  const points = [
    ...manifestHoles.flatMap((hole) => hole.centerline),
    ...manifestFeatures.flatMap((feature) => feature.rings.flat()),
  ];
  const bounds = courseTwinBoundsForPoints(points);
  const warnings = [
    "Prototype terrain is a deterministic visual surface, not the published Environment Agency LiDAR package.",
  ];
  if (manifestFeatures.length === 0) {
    warnings.push("No semantic course feature polygons are currently saved for this course.");
  }

  return {
    schemaVersion: COURSE_TWIN_SCHEMA_VERSION,
    packageVersion: 1,
    minimumRuntimeVersion: COURSE_TWIN_RUNTIME_VERSION,
    course: { id: course.id, name: course.name, country: course.country },
    origin: {
      ...origin,
      elevationM: 0,
      coordinateSystem: "LOCAL_ENU_METRES",
    },
    bounds,
    terrain: {
      kind: "prototype_semantic",
      resolutionM: null,
      verticalDatum: null,
      warning: warnings[0],
    },
    quality: {
      grade: "D",
      mappedHoles: manifestHoles.length,
      expectedHoles: 18,
      mappedFeatures: manifestFeatures.length,
      verified: false,
      warnings,
    },
    supportedModes: ["flyover", "replay"],
    holes: manifestHoles,
    features: manifestFeatures,
    attribution: [
      {
        label: "Map data from OpenStreetMap contributors",
        url: "https://www.openstreetmap.org/copyright",
        licence: "ODbL 1.0",
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

function teeSetWithMostHoles(rows: Array<{ teeSetId: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.teeSetId, (counts.get(row.teeSetId) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
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
