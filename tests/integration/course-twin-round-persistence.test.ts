import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  appendCourseTwinRoundEvent,
  createCourseTwinRound,
  getCourseTwinRound,
} from "@/lib/course-twin-round-store";
import type { CourseTwinRoundEventInput } from "@/lib/course-twin-round";

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
describe.skipIf(!enabled)("Course Twin round persistence", () => {
  afterAll(closeDb);
  it.each(["live", "play"] as const)(
    "saves and replays %s rounds without duplicate analytics",
    async (mode) => {
      const db = postgres(url!, { max: 1 });
      let owner: string | undefined;
      let foreign: string | undefined;
      let courseId: string | undefined;
      try {
        owner = (
          await db`insert into fkh_users(name) values('Synthetic twin owner') returning id`
        )[0].id;
        foreign = (
          await db`insert into fkh_users(name) values('Synthetic twin foreign') returning id`
        )[0].id;
        courseId = (
          await db`insert into fkh_courses(name,created_by_user_id,visibility) values('Synthetic twin course',${owner!},'private') returning id`
        )[0].id;
        const clubId = (
          await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},'7i','synthetic-twin') returning id`
        )[0].id;
        const round = await createCourseTwinRound({
          courseId: courseId!,
          userId: owner!,
          input: {
            mode,
            holeCount: 9,
            startingHole: 1,
            rules: {
              windSpeedMph: 0,
              windDirectionDeg: 0,
              greenRule: "automatic_putts",
              mulligansAllowed: false,
              competition: false,
            },
          },
        });
        let version = round.version;
        const send = (
          input: CourseTwinRoundEventInput,
          expectedVersion = version,
          userId = owner!,
        ) => appendCourseTwinRoundEvent({ roundId: round.id, userId, expectedVersion, input });
        const first: CourseTwinRoundEventInput = {
          type: "shot.accepted",
          clientEventId: crypto.randomUUID(),
          payload: {
            holeNumber: 1,
            shotNumber: 1,
            clubId,
            clubType: "7i",
            source: "modelled",
            start: [0, 0, 0],
            carryEnd: [0, 0, 100],
            totalEnd: [0, 0, 110],
            metrics: {
              carryYd: 110,
              totalYd: 120,
              ballSpeedMph: null,
              clubSpeedMph: null,
              launchAngleDeg: null,
              launchDirectionDeg: null,
              spinRate: null,
              spinAxis: null,
            },
            result: { finalSurface: "green", penalty: null, bounceCount: 0 },
          },
        };
        expect((await send(first, version, foreign!)).status).toBe("not_found");
        expect(await getCourseTwinRound(round.id, foreign!)).toBeNull();
        expect((await send(first)).status).toBe("created");
        version++;
        expect((await send(first, 1)).status).toBe("duplicate");
        expect((await send({ ...first, clientEventId: crypto.randomUUID() }, 1)).status).toBe(
          "conflict",
        );
        for (let holeNumber = 1; holeNumber <= 9; holeNumber++) {
          expect(
            (
              await send({
                type: "hole.completed",
                clientEventId: crypto.randomUUID(),
                payload: {
                  holeNumber,
                  par: 4,
                  yards: 300,
                  strokes: holeNumber === 1 ? 3 : 2,
                  putts: 2,
                  penalties: 0,
                  fairwayHit: null,
                  gir: null,
                },
              })
            ).status,
          ).toBe("created");
          version++;
        }
        const finish: CourseTwinRoundEventInput = {
          type: "round.completed",
          clientEventId: crypto.randomUUID(),
          payload: {},
        };
        expect((await send(finish)).status).toBe("created");
        expect((await send(finish)).status).toBe("duplicate");
        expect((await getCourseTwinRound(round.id, owner!))?.status).toBe("complete");
        const saved =
          await db`select id,type,source,play_context from fkh_sessions where user_id=${owner!}`;
        expect(saved).toHaveLength(mode === "live" ? 1 : 0);
        if (mode === "live") {
          expect(saved[0]).toMatchObject({
            type: "simulated_course",
            source: "course_twin_live",
            play_context: "simulated_course",
          });
          const shots =
            await db`select quality_tag,club_data_est_type,source_raw_json from fkh_shots where session_id=${saved[0].id}`;
          expect(shots).toHaveLength(1);
          expect(shots[0]).toMatchObject({
            quality_tag: "modelled",
            club_data_est_type: "course_twin_modelled",
          });
          expect(shots[0].source_raw_json.source).toBe("modelled");
        }
        expect(
          await db`select id from fkh_course_twin_round_events where round_id=${round.id}`,
        ).toHaveLength(11);
      } finally {
        if (owner) await db`delete from fkh_users where id=${owner}`;
        if (foreign) await db`delete from fkh_users where id=${foreign}`;
        if (courseId) await db`delete from fkh_courses where id=${courseId}`;
        await db.end();
      }
    },
  );
});
