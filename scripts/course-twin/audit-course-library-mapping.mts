import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import postgres from "postgres";

import * as googleCourseNamespace from "../../src/lib/google-course-enrichment";
import * as osmCourseNamespace from "../../src/lib/osm-course-search";

const googleCourseModule = googleCourseNamespace as typeof googleCourseNamespace & {
  default?: typeof googleCourseNamespace;
};
const osmCourseModule = osmCourseNamespace as typeof osmCourseNamespace & {
  default?: typeof osmCourseNamespace;
};
const { searchGoogleCourses } = googleCourseModule.default ?? googleCourseModule;
const { getOsmHoleGeometry } = osmCourseModule.default ?? osmCourseModule;

type GoogleMatch = Awaited<ReturnType<typeof searchGoogleCourses>>[number];
type MappingProbe = {
  courseId: string;
  googleMatch: GoogleMatch | null;
  mappedHoles: number;
  geometryRows: number;
  duplicateHoleNumbers: number;
  geometryReady: boolean;
  repeatVerified: boolean;
  errors: string[];
};

const USER_ID = "c0c02d1e-605a-47c5-a023-83a1c0d18195";
const OUTPUT_PATH = resolve("tools/course-twin-builder/catalog/course-library-mapping-audit.json");
const SKIP_EXTERNAL_IDS = new Set(["adf90577", "forekinghell-tour-links"]);

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });

try {
  const courseRows = await sql`
    WITH hole_counts AS (
      SELECT course_id, COUNT(DISTINCT hole_number)::int AS mapped_holes
      FROM public.fkh_holes
      GROUP BY course_id
    ),
    latest_builds AS (
      SELECT DISTINCT ON (twin.course_id)
        twin.course_id,
        twin.status AS twin_status,
        build.status AS build_status,
        (build.progress_json -> 'plan') IS NOT NULL AS has_build_plan
      FROM public.fkh_course_twins twin
      LEFT JOIN public.fkh_course_twin_builds build ON build.course_twin_id = twin.id
      ORDER BY twin.course_id, build.created_at DESC NULLS LAST
    )
    SELECT
      course.id,
      course.name,
      course.country,
      course.provider,
      course.external_id,
      course.latitude,
      course.longitude,
      COALESCE(hole_counts.mapped_holes, 0)::int AS mapped_holes,
      latest_builds.twin_status,
      latest_builds.build_status,
      COALESCE(latest_builds.has_build_plan, false) AS has_build_plan
    FROM public.fkh_courses course
    LEFT JOIN hole_counts ON hole_counts.course_id = course.id
    LEFT JOIN latest_builds ON latest_builds.course_id = course.id
    WHERE course.visibility = 'shared' OR course.created_by_user_id = ${USER_ID}::uuid
    ORDER BY lower(course.name), course.created_at
  `;

  const localPackages = await readLocalPackages();
  const localByCourseId = new Map(localPackages.map((course) => [course.courseId, course]));
  const sourceGaps = courseRows.filter(
    (course) =>
      !localByCourseId.has(course.id) &&
      Number(course.mapped_holes) < 9 &&
      !SKIP_EXTERNAL_IDS.has(String(course.external_id ?? "")),
  );
  const probes = process.argv.includes("--probe-missing")
    ? await mapLimit(sourceGaps, 2, probeCourse)
    : await readExistingProbes();
  const probesByCourseId = new Map(probes.map((probe: MappingProbe) => [probe.courseId, probe]));

  const courses = courseRows.map((course) => {
    const localPackage = localByCourseId.get(course.id) ?? null;
    const probe = probesByCourseId.get(course.id) ?? null;
    const status = localPackage
      ? "package_registered"
      : course.external_id === "bootle-golf-course"
        ? "bootle_pilot"
        : course.has_build_plan
          ? "build_plan_queued"
          : Number(course.mapped_holes) >= 9 &&
              course.latitude !== null &&
              course.longitude !== null
            ? "source_ready_needs_plan"
            : SKIP_EXTERNAL_IDS.has(String(course.external_id ?? ""))
              ? "non_real_or_test_course"
              : probe?.geometryReady && probe.repeatVerified
                ? "verified_external_geometry"
                : probe?.googleMatch
                  ? "location_found_geometry_missing"
                  : "source_mapping_missing";

    return {
      courseId: course.id,
      name: course.name,
      country: course.country,
      status,
      localPackage,
      database: {
        coordinates: course.latitude !== null && course.longitude !== null,
        mappedHoles: Number(course.mapped_holes),
        twinStatus: course.twin_status,
        buildStatus: course.build_status,
        hasBuildPlan: Boolean(course.has_build_plan),
      },
      sourceProbe: probe,
    };
  });

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: "Visible ForeKingHell course library for the primary LM World Tour account",
    summary: {
      courses: courses.length,
      registeredPackages: courses.filter((course) => course.status === "package_registered").length,
      bootlePilots: courses.filter((course) => course.status === "bootle_pilot").length,
      queuedBuildPlans: courses.filter((course) => course.status === "build_plan_queued").length,
      sourceReadyNeedsPlan: courses.filter((course) => course.status === "source_ready_needs_plan")
        .length,
      verifiedExternalGeometry: courses.filter(
        (course) => course.status === "verified_external_geometry",
      ).length,
      locationOnly: courses.filter((course) => course.status === "location_found_geometry_missing")
        .length,
      sourceMappingMissing: courses.filter((course) => course.status === "source_mapping_missing")
        .length,
      nonRealOrTestCourses: courses.filter((course) => course.status === "non_real_or_test_course")
        .length,
    },
    courses,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT_PATH, summary: report.summary }, null, 2));
} finally {
  await sql.end();
}

async function readLocalPackages() {
  const directory = resolve("src/generated/course-twins");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  const packages = [];

  for (const file of files) {
    const manifest = JSON.parse(await readFile(resolve(directory, file), "utf8"));
    if (!manifest.course?.id || !manifest.terrain?.imagery?.url) continue;
    packages.push({
      courseId: manifest.course.id as string,
      slug: file.replace(/\.json$/, ""),
      grade: manifest.quality?.grade ?? null,
      mappedHoles: manifest.quality?.mappedHoles ?? manifest.holes?.length ?? 0,
      mappedFeatures: manifest.quality?.mappedFeatures ?? manifest.features?.length ?? 0,
      imageryUrl: manifest.terrain.imagery.url as string,
      terrainUrl: (manifest.terrain.heightmap?.url as string | undefined) ?? null,
    });
  }

  return packages;
}

async function readExistingProbes(): Promise<MappingProbe[]> {
  try {
    const report = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    return Array.isArray(report.courses)
      ? report.courses.flatMap((course: Record<string, unknown>) => {
          const probe = course.sourceProbe;
          return probe && typeof probe === "object" ? [probe as MappingProbe] : [];
        })
      : [];
  } catch {
    return [];
  }
}

async function probeCourse(course: Record<string, unknown>) {
  const errors: string[] = [];
  let googleMatch: GoogleMatch | null = null;
  try {
    const matches = await searchGoogleCourses(`${course.name} ${course.country ?? ""}`, {
      limit: 1,
    });
    googleMatch = matches[0] ?? null;
  } catch (error) {
    errors.push(`google: ${formatError(error)}`);
  }

  let holes: Awaited<ReturnType<typeof getOsmHoleGeometry>> = [];
  if (typeof googleMatch?.latitude === "number" && typeof googleMatch.longitude === "number") {
    try {
      holes = await getOsmHoleGeometry(googleMatch.latitude, googleMatch.longitude);
    } catch (error) {
      errors.push(`osm: ${formatError(error)}`);
    }
  }
  const mappedHoles = new Set(holes.map((hole) => hole.holeNumber)).size;
  const geometryRows = holes.length;
  const duplicateHoleNumbers = geometryRows - mappedHoles;
  const repeatHoles =
    mappedHoles >= 9 &&
    duplicateHoleNumbers === 0 &&
    typeof googleMatch?.latitude === "number" &&
    typeof googleMatch.longitude === "number"
      ? await getOsmHoleGeometry(googleMatch.latitude, googleMatch.longitude).catch(() => [])
      : [];
  const repeatVerified =
    repeatHoles.length === holes.length &&
    geometryFingerprint(repeatHoles) === geometryFingerprint(holes);

  console.log(
    JSON.stringify({
      course: course.name,
      googleMatch: googleMatch?.name ?? null,
      mappedHoles,
      geometryRows,
      duplicateHoleNumbers,
      repeatVerified,
      errors,
    }),
  );

  return {
    courseId: String(course.id),
    googleMatch,
    mappedHoles,
    geometryRows,
    duplicateHoleNumbers,
    geometryReady: mappedHoles >= 9 && duplicateHoleNumbers === 0,
    repeatVerified,
    errors,
  };
}

function geometryFingerprint(holes: Awaited<ReturnType<typeof getOsmHoleGeometry>>) {
  return JSON.stringify(
    holes.map((hole) => [hole.holeNumber, hole.teeLat, hole.teeLng, hole.greenLat, hole.greenLng]),
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function mapLimit<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    }),
  );
  return results;
}
