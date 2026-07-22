import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import postgres from "postgres";

import { generateCourseTwinCompletion } from "./generator.mjs";

const courseId = requiredArgument("--course-id");
const slug = requiredArgument("--slug");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
try {
  const [row] = await sql`
    SELECT progress_json
    FROM fkh_course_twin_builds AS builds
    INNER JOIN fkh_course_twins AS twins ON twins.id = builds.course_twin_id
    WHERE twins.course_id = ${courseId}
      AND builds.progress_json -> 'plan' IS NOT NULL
    ORDER BY builds.created_at DESC
    LIMIT 1
  `;
  const plan = row?.progress_json?.plan;
  if (!plan) throw new Error(`No Course Twin build plan exists for ${courseId}.`);

  const completion = await generateCourseTwinCompletion(plan);
  const publicDirectory = resolve("public/course-twins", slug);
  const generatedDirectory = resolve("src/generated/course-twins");
  await mkdir(publicDirectory, { recursive: true });
  await mkdir(generatedDirectory, { recursive: true });

  for (const asset of completion.assets) {
    await writeFile(
      resolve(publicDirectory, asset.fileName),
      Buffer.from(asset.dataBase64, "base64"),
    );
  }

  const manifest = {
    ...completion.manifest,
    terrain: {
      ...completion.manifest.terrain,
      heightmap: completion.manifest.terrain.heightmap
        ? {
            ...completion.manifest.terrain.heightmap,
            url: `/course-twins/${slug}/terrain.f32`,
          }
        : null,
      imagery: completion.manifest.terrain.imagery
        ? {
            ...completion.manifest.terrain.imagery,
            url: `/course-twins/${slug}/imagery.jpg`,
          }
        : null,
    },
  };
  const manifestPath = resolve(generatedDirectory, `${slug}.json`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        course: manifest.course,
        quality: manifest.quality,
        terrain: {
          kind: manifest.terrain.kind,
          resolutionM: manifest.terrain.resolutionM,
          width: manifest.terrain.heightmap?.width,
          height: manifest.terrain.heightmap?.height,
        },
        manifestPath,
        publicDirectory,
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value || value.startsWith("--")) throw new Error(`${name} is required.`);
  return value;
}
