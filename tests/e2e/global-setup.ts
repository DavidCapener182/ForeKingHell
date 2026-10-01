import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

export default async function prepareLocalCatalogue() {
  if (process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1") return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("Local auth bypass tests require a disposable localhost database.");
  }

  // The packaged twins are checked in, but migrations intentionally do not seed
  // the shared course directory. Populate only this isolated test database.
  const directory = path.resolve("src/generated/course-twins");
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    for (const fileName of await readdir(directory)) {
      if (!fileName.endsWith(".json")) continue;
      const manifest = JSON.parse(await readFile(path.join(directory, fileName), "utf8"));
      if (!manifest.course?.id || !manifest.course?.name) continue;
      await sql`insert into fkh_courses (id, name, country, visibility)
        values (${manifest.course.id}, ${manifest.course.name}, ${manifest.course.country ?? null}, 'shared')
        on conflict (id) do nothing`;
      const [teeSet] = await sql`insert into fkh_tee_sets (course_id, name, par, yards)
        values (${manifest.course.id}, 'Packaged twin test tees', ${manifest.holes.reduce((total: number, hole: { par: number }) => total + hole.par, 0)}, ${manifest.holes.reduce((total: number, hole: { yards: number }) => total + hole.yards, 0)})
        on conflict (course_id, name) do update set name = excluded.name returning id`;
      // Convert packaged local ENU coordinates to approximate geographic test
      // positions. These disposable rows support the companion Strategy map.
      const geographic = (point: number[]) => [
        manifest.origin.longitude +
          point[0] / (111320 * Math.cos((manifest.origin.latitude * Math.PI) / 180)),
        manifest.origin.latitude - point[2] / 111320,
      ];
      for (const hole of manifest.holes) {
        const tee = geographic(hole.tee);
        const green = geographic(hole.green);
        const centerline = { type: "LineString", coordinates: hole.centerline.map(geographic) };
        await sql`insert into fkh_holes (course_id, tee_set_id, hole_number, par, stroke_index, yards, tee_lat, tee_lng, green_lat, green_lng, centerline_geojson)
          values (${manifest.course.id}, ${teeSet.id}, ${hole.holeNumber}, ${hole.par}, ${hole.strokeIndex ?? null}, ${hole.yards}, ${tee[1]}, ${tee[0]}, ${green[1]}, ${green[0]}, ${sql.json(centerline)})
          on conflict (tee_set_id, hole_number) do nothing`;
      }
    }
  } finally {
    await sql.end();
  }
}
