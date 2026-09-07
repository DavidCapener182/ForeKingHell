import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  importCourseTwinCatalog,
  processNextCourseTwinCatalogJob,
} from "@/lib/course-twin-catalog-import";

vi.mock("@/lib/course-auto-enrichment", () => ({
  ensureCourseAutoImport: vi.fn(async () => {
    throw new Error("Synthetic stop before provider access");
  }),
}));
vi.mock("@/lib/course-twin-build-jobs", () => ({ enqueueCourseTwinBuild: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    target?.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}

describe.skipIf(!enabled)("catalogue course ownership", () => {
  afterAll(closeDb);
  it.each([
    { visibility: "private", owned: true },
    { visibility: "shared", owned: true },
    { visibility: "private", owned: false },
    { visibility: "shared", owned: false },
  ])(
    "preserves ownership boundaries for $visibility courses (owned=$owned)",
    async ({ visibility, owned }) => {
      const db = postgres(url!, { max: 1 });
      let owner: string | undefined;
      const osmId = String(Date.now()) + String(Math.floor(Math.random() * 100000));
      const externalId = `osm-way-${osmId}`;
      try {
        expect(
          await db`select id from fkh_course_twin_catalog_jobs where status='queued' and next_attempt_at <= now()`,
        ).toHaveLength(0);
        owner = (
          await db`insert into fkh_users(name) values('Synthetic catalogue owner') returning id`
        )[0].id;
        await db`insert into fkh_courses(name,provider,external_id,created_by_user_id,visibility) values('Private original','osm',${externalId},${owned ? owner! : null},${visibility})`;
        const original = await db`select * from fkh_courses where external_id=${externalId}`;
        const queued = await importCourseTwinCatalog({
          requestedByUserId: owner!,
          candidates: [
            {
              externalId,
              osmType: "way",
              osmId,
              name: "Catalogue replacement",
              country: "England",
              latitude: 53,
              longitude: -3,
              website: null,
              mappedHoles: 18,
              mappedGreens: 18,
              mappedFairways: 18,
              mappedBunkers: 1,
              mappedTees: 18,
              mappedWater: 0,
              readinessScore: 90,
              sourceRegion: "synthetic",
            },
          ],
        });
        await db`update fkh_course_twin_catalog_jobs set next_attempt_at='2000-01-01' where id=${queued.jobs[0].id}`;
        expect((await processNextCourseTwinCatalogJob())?.jobId).toBe(queued.jobs[0].id);
        const saved = await db`select * from fkh_courses where external_id=${externalId}`;
        if (!owned && visibility === "shared") {
          expect(saved).toHaveLength(1);
          expect(saved[0]).toMatchObject({
            id: original[0].id,
            name: "Catalogue replacement",
            created_by_user_id: null,
            visibility: "shared",
            latitude: 53,
            longitude: -3,
          });
        } else {
          expect(saved).toEqual(original);
        }
      } finally {
        await db`delete from fkh_course_twin_catalog_jobs where external_id=${externalId}`;
        await db`delete from fkh_courses where external_id=${externalId}`;
        if (owner) await db`delete from fkh_users where id=${owner}`;
        await db.end();
      }
    },
  );
});
