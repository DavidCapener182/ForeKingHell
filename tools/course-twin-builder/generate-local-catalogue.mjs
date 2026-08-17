#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import postgres from "postgres";

import { generateCourseTwinCompletion } from "./generator.mjs";
import {
  packageSlugForCourse,
  readLocalCourseTwinPackage,
  writeLocalCourseTwinPackage,
} from "./local-catalogue.mjs";
import { summarizeVisualQa } from "./visual-qa.mjs";

const rootDirectory = process.cwd();
const catalogPath = resolve(
  argumentValue("--catalog") ?? "tools/course-twin-builder/catalog/uk-first-wave-ingested.json",
);
const reportPath = resolve(
  argumentValue("--report") ?? "tools/course-twin-builder/catalog/uk-first-wave-packages.json",
);
const visualQaPath = resolve(
  argumentValue("--visual-qa") ?? "tools/course-twin-builder/catalog/uk-first-wave-visual-qa.json",
);
const registryPath = resolve("src/generated/course-twins/local-catalogue.ts");
const concurrency = Number(argumentValue("--concurrency") ?? 2);
const rebuild = process.argv.includes("--rebuild");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
  throw new Error("--concurrency must be an integer from 1 to 4.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
if (!Array.isArray(catalog.courses) || catalog.courses.length < 20 || catalog.courses.length > 50) {
  throw new Error("The production catalogue must contain between 20 and 50 courses.");
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: concurrency });
const pending = [...catalog.courses];
const packages = [];
const failures = [];

try {
  await Promise.all(
    Array.from({ length: concurrency }, (_, workerIndex) =>
      runWorker({ workerIndex: workerIndex + 1 }),
    ),
  );
} finally {
  await sql.end();
}

packages.sort((left, right) => left.name.localeCompare(right.name));
failures.sort((left, right) => left.name.localeCompare(right.name));
const visualQaDocument = JSON.parse(await readFile(visualQaPath, "utf8"));
const visualQa = summarizeVisualQa({ packages, document: visualQaDocument });
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceCatalog: relative(rootDirectory, catalogPath),
  requested: catalog.courses.length,
  completed: packages.length,
  failed: failures.length,
  packageGenerationComplete: failures.length === 0 && packages.length === catalog.courses.length,
  manualVisualQaComplete: visualQa.complete,
  visualQa: {
    report: relative(rootDirectory, visualQaPath),
    ...visualQa,
  },
  packages,
  failures,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(registryPath, generatedRegistrySource(packages));
console.log(
  `Wrote ${packages.length}/${catalog.courses.length} packages, ${reportPath} and ${registryPath}`,
);
if (!report.packageGenerationComplete) process.exitCode = 1;

async function runWorker({ workerIndex }) {
  while (pending.length > 0) {
    const course = pending.shift();
    if (!course) return;
    try {
      const slug = packageSlugForCourse(course);
      if (!rebuild) {
        const existing = await readLocalCourseTwinPackage({
          courseId: course.courseId,
          slug,
          rootDirectory,
        });
        if (existing) {
          packages.push(reportEntry(existing, slug));
          console.log(`[${workerIndex}] Verified ${course.name}`);
          continue;
        }
      }
      const [row] = await sql`
        SELECT builds.progress_json
        FROM fkh_course_twin_builds AS builds
        INNER JOIN fkh_course_twins AS twins ON twins.id = builds.course_twin_id
        WHERE twins.course_id = ${course.courseId}
          AND builds.progress_json -> 'plan' IS NOT NULL
        ORDER BY builds.created_at DESC
        LIMIT 1
      `;
      const plan = row?.progress_json?.plan;
      if (!plan) throw new Error("No queued Course Twin build plan is available.");
      console.log(`[${workerIndex}] Building ${course.name} (${slug})`);
      const completion = await generateCourseTwinCompletion(plan);
      const written = await writeLocalCourseTwinPackage({
        completion,
        slug,
        rootDirectory,
      });
      packages.push(reportEntry(written, slug));
      console.log(`[${workerIndex}] Completed ${course.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ courseId: course.courseId, name: course.name, error: message });
      console.error(`[${workerIndex}] Failed ${course.name}: ${message}`);
    }
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function reportEntry(written, slug) {
  return {
    courseId: written.manifest.course.id,
    name: written.manifest.course.name,
    slug,
    qualityGrade: written.manifest.quality.grade,
    mappedHoles: written.manifest.quality.mappedHoles,
    mappedFeatures: written.manifest.quality.mappedFeatures,
    terrainKind: written.manifest.terrain.kind,
    terrainResolutionM: written.manifest.terrain.resolutionM,
    previewImageUrl: written.manifest.terrain.imagery?.url ?? null,
    warnings: written.manifest.quality.warnings,
    assets: written.assets,
  };
}

function generatedRegistrySource(entries) {
  const metadata = entries
    .map((entry) => {
      const value = {
        courseId: entry.courseId,
        name: entry.name,
        grade: entry.qualityGrade,
        previewImageUrl: entry.previewImageUrl ?? null,
        mappedHoles: entry.mappedHoles,
        terrainResolutionM: entry.terrainResolutionM ?? null,
      };
      return `  ${JSON.stringify(entry.courseId)}: ${JSON.stringify(value)},`;
    })
    .join("\n");
  const loaders = entries
    .map((entry) => `  ${JSON.stringify(entry.courseId)}: () => import("./${entry.slug}.json"),`)
    .join("\n");
  return `import type { CourseTwinManifest } from "@/lib/course-twin-contract";\n\nexport type LocalCourseTwinMetadata = {\n  courseId: string;\n  name: string;\n  grade: "A" | "B" | "C" | "D";\n  previewImageUrl: string | null;\n  mappedHoles: number;\n  terrainResolutionM: number | null;\n};\n\n/** Lightweight catalogue data used by directory and availability queries. */\nexport const localCourseTwinMetadataByCourseId: Record<string, LocalCourseTwinMetadata> = {\n${metadata}\n};\n\nconst manifestLoaders: Record<string, () => Promise<unknown>> = {\n${loaders}\n};\n\n/** Loads one complete manifest on demand, keeping the catalogue out of the base server module. */\nexport async function loadLocalCourseTwinManifest(courseId: string): Promise<CourseTwinManifest | null> {\n  const loader = manifestLoaders[courseId];\n  if (!loader) return null;\n  const importedManifest = await loader();\n  return ((importedManifest as { default?: CourseTwinManifest }).default ?? importedManifest) as CourseTwinManifest;\n}\n`;
}
