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

const rootDirectory = process.cwd();
const catalogPath = resolve(
  argumentValue("--catalog") ?? "tools/course-twin-builder/catalog/uk-first-wave-ingested.json",
);
const reportPath = resolve(
  argumentValue("--report") ?? "tools/course-twin-builder/catalog/uk-first-wave-packages.json",
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
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceCatalog: relative(rootDirectory, catalogPath),
  requested: catalog.courses.length,
  completed: packages.length,
  failed: failures.length,
  packageGenerationComplete: failures.length === 0 && packages.length === catalog.courses.length,
  manualVisualQaComplete: false,
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
    warnings: written.manifest.quality.warnings,
    assets: written.assets,
  };
}

function generatedRegistrySource(entries) {
  const imports = entries
    .map((entry, index) => `import manifest${index} from "./${entry.slug}.json";`)
    .join("\n");
  const mappings = entries
    .map((entry, index) => `  ${JSON.stringify(entry.courseId)}: manifest${index},`)
    .join("\n");
  return `${imports}\n\nexport const localCourseTwinManifestsByCourseId: Record<string, unknown> = {\n${mappings}\n};\n`;
}
