import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import postgres from "postgres";

import { hasLocalAuthBypass } from "./helpers";
import { createLocalBypassStorageState } from "./local-auth";

export async function prepareFlightPathFixture(
  page: Page,
  baseURL: string,
  multipleClubs = false,
  admin = false,
  roundCourseId?: string,
  competitions = false,
  secondSession = false,
  stockExclusion = false,
  strokesGained = false,
): Promise<
  (() => Promise<void>) & { sessionId?: string; challengeId?: string; tournamentId?: string }
> {
  if (!hasLocalAuthBypass) return async () => {};

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("The local flight-path fixture requires a disposable localhost database.");
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const userId = randomUUID();
  const clubId = randomUUID();
  const sessionId = randomUUID();
  const challengeId = randomUUID();
  const tournamentId = randomUUID();
  const cleanup = async () => {
    try {
      await sql`delete from fkh_shots where user_id = ${userId}`;
      await sql`delete from fkh_users where id = ${userId}`;
    } finally {
      await sql.end();
    }
  };

  try {
    await sql.begin(async (tx) => {
      await tx`insert into fkh_users (id, email, name) values (${userId}, ${`${userId}@example.test`}, 'Flight path test')`;
      if (admin) {
        await tx`insert into fkh_admin_users (user_id, role, status) values (${userId}, 'owner', 'active')`;
      }
      await tx`insert into fkh_entitlements (user_id, entitlement_key, value_json, source)
        values (${userId}, 'lifetime_full', '{"value":true}', 'e2e-fixture')`;
      await tx`insert into fkh_sessions (id, user_id, source, type, date, raw_csv_text, file_name)
        values (${sessionId}, ${userId}, 'rapsodo', 'range', now(), '', 'flight-path-e2e.csv')`;
      if (strokesGained) {
        await tx`insert into fkh_strokes_gained_shot_events
          (user_id, session_id, category, start_lie, end_lie, start_distance_yd, end_distance_yd, hole_number, stroke_number, strokes_gained)
          values (${userId}, ${sessionId}, 'approach', 'fairway', 'green', 150, 5, 1, 1, 0.4),
                 (${userId}, ${sessionId}, 'putting', 'green', 'holed', 5, 0, 1, 2, -0.2)`;
      }
      if (roundCourseId) {
        await tx`update fkh_sessions set type = 'real_round', play_context = 'on_course', course_id = ${roundCourseId}, course_name = 'Aintree Golf Centre' where id = ${sessionId}`;
        await tx`update fkh_sessions set tee_set_id = (select id from fkh_tee_sets where course_id = ${roundCourseId} order by created_at limit 1),
          scorecard_json = (select jsonb_agg(jsonb_build_object('holeNumber', hole_number, 'par', par, 'yards', yards,
            'name', null, 'score', par + 1, 'putts', 2, 'penalties', 0, 'fairwayHit', true, 'gir', false) order by hole_number)
            from fkh_holes where tee_set_id = (select id from fkh_tee_sets where course_id = ${roundCourseId} order by created_at limit 1))
          where id = ${sessionId}`;
      }
      if (competitions) {
        await tx`insert into fkh_challenges (id, creator_user_id, title, visibility, starts_at, ends_at)
          values (${challengeId}, ${userId}, 'Playwright private measured challenge', 'private', now() - interval '1 day', now() + interval '7 days')`;
        await tx`insert into fkh_challenge_entries (challenge_id, user_id) values (${challengeId}, ${userId})`;
        await tx`insert into fkh_tournaments (id, created_by_user_id, title, visibility, starts_at, ends_at)
          values (${tournamentId}, ${userId}, 'Playwright private tournament', 'private', now() - interval '1 day', now() + interval '7 days')`;
      }
      const clubs = multipleClubs
        ? ([
            ["Driver", 240],
            ["7 Iron", 150],
            ["Pitching Wedge", 105],
          ] as const)
        : ([["7 Iron", 150]] as const);
      for (const [clubIndex, [clubType, baseline]] of clubs.entries()) {
        // Keep tied recommendation ordering stable while each fixture owns unique IDs.
        const fixtureClubId = multipleClubs
          ? `${userId.slice(0, 24)}${String(clubIndex + 1).padStart(12, "0")}`
          : clubId;
        await tx`insert into fkh_clubs (id, user_id, type, normalized_club_key)
          values (${fixtureClubId}, ${userId}, ${clubType}, ${clubType.toLowerCase().replaceAll(" ", "-")})`;
        if (multipleClubs) {
          await tx`insert into fkh_stock_yardages (user_id, club_id, sample_size, carry_median_yd,
            total_median_yd, confidence_score, recommended_play_number_yd)
            values (${userId}, ${fixtureClubId}, 20, ${baseline + 2.5}, ${baseline + 7.5}, 85, ${baseline + 2.5})`;
        }
        for (let index = 0; index < (multipleClubs ? 20 : 3); index++) {
          const carry = baseline + (index % 6);
          const side = index % 3 === 0 ? -5 : index % 3 === 1 ? 6 : 0;
          const ballSpeed = clubType === "Driver" ? 145 : clubType === "7 Iron" ? 105 : 80;
          await tx`insert into fkh_shots (user_id, session_id, club_id, shot_at, shot_number, club_type,
            carry_yd, total_yd, side_carry_yd, ball_speed_mph, club_speed_mph,
            launch_angle_deg, launch_direction_deg, club_path_deg, face_angle_deg,
            apex_ft, smash_factor, spin_rate, spin_axis, source_raw_json)
            values (${userId}, ${sessionId}, ${fixtureClubId}, now() - ${(clubs.length - 1 - clubIndex) * 20 + (19 - index)} * interval '1 second', ${clubIndex * 20 + index + 1}, ${clubType}, ${carry}, ${carry + 5}, ${side},
              ${ballSpeed}, ${ballSpeed / 1.4}, 18, ${side / 5}, 2, 1, 85, 1.4, 4500, ${side}, '{}')`;
        }
      }
      if (stockExclusion) {
        await tx`update fkh_shots set carry_yd = carry_yd / 2, total_yd = total_yd / 2 where id = (select id from fkh_shots where session_id = ${sessionId} order by id limit 1)`;
      }
      if (secondSession) {
        const baselineSessionId = randomUUID();
        await tx`insert into fkh_sessions (id, user_id, source, type, date, raw_csv_text, file_name)
          values (${baselineSessionId}, ${userId}, 'rapsodo', 'range', now() - interval '3 days', '', 'flight-path-baseline-e2e.csv')`;
        await tx`insert into fkh_shots (user_id, session_id, club_id, shot_at, shot_number, club_type,
          carry_yd, total_yd, side_carry_yd, ball_speed_mph, club_speed_mph, launch_angle_deg,
          launch_direction_deg, club_path_deg, face_angle_deg, apex_ft, smash_factor, spin_rate, spin_axis, source_raw_json)
          select user_id, ${baselineSessionId}, club_id, now() - interval '3 days', club_type,
          carry_yd - 2, total_yd - 2, side_carry_yd, ball_speed_mph, club_speed_mph, launch_angle_deg,
          launch_direction_deg, club_path_deg, face_angle_deg, apex_ft, smash_factor, spin_rate, spin_axis, source_raw_json
          from fkh_shots where session_id = ${sessionId}`;
      }
      if (roundCourseId) {
        await tx`update fkh_shots set course_hole_number = 1, course_hole_shot_number = 1, shot_number = 1 where session_id = ${sessionId}`;
      }
    });
    await page.context().addCookies(createLocalBypassStorageState(baseURL, userId).cookies);
    return Object.assign(cleanup, {
      sessionId,
      challengeId: competitions ? challengeId : undefined,
      tournamentId: competitions ? tournamentId : undefined,
    });
  } catch (error) {
    await cleanup();
    throw error;
  }
}
