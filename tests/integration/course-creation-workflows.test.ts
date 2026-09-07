import { afterAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { ensureCourseFeatures } from "@/lib/course-feature-enrichment";
import {
  createCourseAction,
  createOsmCourseAction,
  createGoogleCourseAction,
} from "@/app/courses/actions";
vi.mock("@/lib/google-course-enrichment", () => ({
  getGoogleCourseDetails: async (placeId: string) => ({
    placeId,
    name: `Synthetic ${placeId}`,
    address: null,
    country: null,
    latitude: null,
    longitude: null,
    rating: null,
    userRatingsTotal: null,
    types: [],
    website: null,
    googleMapsUrl: null,
    phoneNumber: null,
    openingHours: {},
    attributions: [],
    photoReferences: [],
  }),
}));
vi.mock("@/lib/course-feature-enrichment", () => ({ ensureCourseFeatures: vi.fn() }));
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Disposable local database required");
}
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
describe.skipIf(!enabled)("course creation recovery", () => {
  afterAll(closeDb);
  it("rolls back earlier imported holes when a later hole fails", async () => {
    const db = postgres(url!, { max: 1 });
    const owner = (
      await db`insert into fkh_users(name) values('Synthetic hole rollback') returning id`
    )[0].id;
    const marker = `hole_fault_${crypto.randomUUID().replaceAll("-", "")}`;
    try {
      actor.id = owner;
      await db.unsafe(
        `create function ${marker}() returns trigger language plpgsql as $$ begin if new.hole_number=2 and exists(select 1 from fkh_courses where id=new.course_id and created_by_user_id='${owner}'::uuid) then raise exception 'Synthetic second hole failure'; end if; return new; end $$`,
      );
      await db.unsafe(
        `create trigger ${marker} before insert on fkh_holes for each row execute function ${marker}()`,
      );
      const form = new FormData();
      form.set("name", "Synthetic two-hole import");
      form.set("osmType", "way");
      form.set("osmId", marker);
      form.set(
        "holesJson",
        JSON.stringify(
          [1, 2].map((holeNumber) => ({
            holeNumber,
            par: 4,
            yards: 350,
            teeLat: 53,
            teeLng: -3,
            greenLat: 53.002,
            greenLng: -3.002,
          })),
        ),
      );
      await expect(createOsmCourseAction(form)).rejects.toThrow();
      expect(await db`select id from fkh_courses where created_by_user_id=${owner}`).toHaveLength(
        0,
      );
      await db.unsafe(`drop trigger ${marker} on fkh_holes`);
      await expect(createOsmCourseAction(form)).rejects.toThrow("redirect:/courses/");
      const saved =
        await db`select h.hole_number from fkh_holes h join fkh_courses c on c.id=h.course_id where c.created_by_user_id=${owner} order by h.hole_number`;
      expect(saved.map((row) => row.hole_number)).toEqual([1, 2]);
    } finally {
      await db.unsafe(`drop trigger if exists ${marker} on fkh_holes`);
      await db.unsafe(`drop function if exists ${marker}()`);
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
      await db.end();
    }
  });
  it.each(["google", "osm"])(
    "opens the saved %s course when enrichment fails",
    async (provider) => {
      const db = postgres(url!, { max: 1 });
      const owner = (
        await db`insert into fkh_users(name) values('Synthetic enrichment failure') returning id`
      )[0].id;
      try {
        actor.id = owner;
        const marker = crypto.randomUUID();
        const form = new FormData();
        form.set("name", `Synthetic ${marker}`);
        form.set("placeId", marker);
        form.set("osmType", "way");
        form.set("osmId", marker);
        vi.mocked(ensureCourseFeatures).mockRejectedValueOnce(
          new Error("Synthetic enrichment failure"),
        );
        const create = provider === "google" ? createGoogleCourseAction : createOsmCourseAction;
        await expect(create(form)).rejects.toThrow(
          /redirect:\/courses\/.*\/holes\?warning=feature-enrichment/,
        );
        expect(await db`select id from fkh_courses where created_by_user_id=${owner}`).toHaveLength(
          1,
        );
      } finally {
        vi.mocked(ensureCourseFeatures).mockReset();
        await db`delete from fkh_courses where created_by_user_id=${owner}`;
        await db`delete from fkh_users where id=${owner}`;
        await db.end();
      }
    },
  );
  it.each([
    ["par", "0"],
    ["par", "72.5"],
    ["par", "not-a-number"],
    ["slopeRating", "54"],
    ["slopeRating", "156"],
    ["yards", "-1"],
    ["courseRating", "-1"],
  ])("rejects invalid %s=%s before creating any course", async (field, value) => {
    const db = postgres(url!, { max: 1 });
    const owner = (
      await db`insert into fkh_users(name) values('Synthetic invalid course') returning id`
    )[0].id;
    try {
      actor.id = owner;
      const form = new FormData();
      form.set("name", "Synthetic invalid numbers");
      form.set("teeName", "Synthetic tee");
      form.set("par", "72");
      form.set(field, value);
      await expect(createCourseAction(form)).rejects.toThrow(/valid|between|positive|whole/i);
      expect(await db`select id from fkh_courses where created_by_user_id=${owner}`).toHaveLength(
        0,
      );
    } finally {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
      await db.end();
    }
  });
  it.each(["manual", "osm", "google"])(
    "rolls back the %s course when its initial tee cannot be saved",
    async (provider) => {
      const create =
        provider === "manual"
          ? createCourseAction
          : provider === "osm"
            ? createOsmCourseAction
            : createGoogleCourseAction;
      const db = postgres(url!, { max: 1 });
      const marker = `course_fault_${crypto.randomUUID().replaceAll("-", "")}`;
      let owner: string | null = null;
      try {
        owner = (
          await db`insert into fkh_users(name) values('Synthetic course creator') returning id`
        )[0].id;
        actor.id = owner!;
        await db.unsafe(
          `create function ${marker}() returns trigger language plpgsql as $$ begin if exists(select 1 from fkh_courses where id=new.course_id and created_by_user_id='${owner}'::uuid) then raise exception 'Synthetic tee save failure'; end if; return new; end $$`,
        );
        await db.unsafe(
          `create trigger ${marker} before insert on fkh_tee_sets for each row execute function ${marker}()`,
        );
        const form = new FormData();
        form.set("name", "Synthetic atomic course");
        form.set("teeName", marker);
        form.set("par", "72");
        form.set("osmType", "way");
        form.set("osmId", marker);
        form.set("placeId", marker);
        await expect(create(form)).rejects.toThrow();
        expect(await db`select id from fkh_courses where created_by_user_id=${owner}`).toHaveLength(
          0,
        );
        await db.unsafe(`drop trigger ${marker} on fkh_tee_sets`);
        await expect(create(form)).rejects.toThrow("redirect:/courses/");
        const saved =
          await db`select c.id,c.visibility,t.name from fkh_courses c join fkh_tee_sets t on t.course_id=c.id where c.created_by_user_id=${owner}`;
        expect(saved).toHaveLength(1);
        expect(saved[0].visibility).toBe("private");
        expect(saved[0].name).toBe(provider === "google" ? "Google Places" : marker);
        if (provider === "google") {
          const [before] =
            await db`select row_to_json(c) as course, (select json_agg(t order by t.id) from fkh_tee_sets t where t.course_id=c.id) as tees from fkh_courses c where c.id=${saved[0].id}`;
          await db.unsafe(
            `create trigger ${marker} before insert on fkh_tee_sets for each row execute function ${marker}()`,
          );
          await expect(create(form)).rejects.toThrow();
          const [after] =
            await db`select row_to_json(c) as course, (select json_agg(t order by t.id) from fkh_tee_sets t where t.course_id=c.id) as tees from fkh_courses c where c.id=${saved[0].id}`;
          expect(after).toEqual(before);
          expect(
            await db`select id from fkh_courses where created_by_user_id=${owner}`,
          ).toHaveLength(1);
        }
      } finally {
        await db.unsafe(`drop trigger if exists ${marker} on fkh_tee_sets`);
        await db.unsafe(`drop function if exists ${marker}()`);
        if (owner) {
          await db`delete from fkh_courses where created_by_user_id=${owner}`;
          await db`delete from fkh_users where id=${owner}`;
        }
        await db.end();
      }
    },
  );
});
