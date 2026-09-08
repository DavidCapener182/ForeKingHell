import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import {
  inviteFriendToChallenge,
  createChallenge,
  joinChallenge,
  leaveChallenge,
  getChallengeDetailData,
  getChallengeSourceInspection,
} from "@/lib/challenges";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const t = url ? new URL(url) : null;
  if (!t || !["localhost", "127.0.0.1"].includes(t.hostname) || t.pathname !== "/fkh_redesign")
    throw new Error("Disposable local challenge database required.");
}
describe.skipIf(!enabled)("imported challenge workflow", () => {
  let sql: ReturnType<typeof postgres>;
  let ids: string[] = [];
  let templateId: string;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  afterEach(async () => {
    await sql`delete from fkh_users where id in ${sql(ids)}`;
    await sql`delete from fkh_challenge_templates where id=${templateId}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  it("rejects unavailable joins and invalid creation dates without adding records", async () => {
    ids = (
      await sql`insert into fkh_users(name) values('Synthetic challenge creator'),('Synthetic challenger') returning id`
    ).map((r) => r.id);
    actor.id = ids[1];
    templateId = (
      await sql`insert into fkh_challenge_templates(slug,name,description,challenge_type,rules_json) values(${crypto.randomUUID()},'Synthetic dates','Fixture','longest_drive','{}'::jsonb) returning id`
    )[0].id;
    const [friendA, friendB] = [...ids].sort();
    await sql`insert into fkh_friendships(user_a_id,user_b_id) values(${friendA},${friendB})`;
    for (const status of ["closed", "draft", "completed", "open"]) {
      const id = (
        await sql`insert into fkh_challenges(template_id,creator_user_id,title,visibility,status,starts_at,ends_at) values(${templateId},${ids[0]},'Synthetic unavailable','public',${status},now()-interval '2 days',now()-interval '1 day') returning id`
      )[0].id;
      if (status !== "open")
        await sql`update fkh_challenges set ends_at=now()+interval '1 day' where id=${id}`;
      await expect(joinChallenge(id)).rejects.toThrow("This challenge is no longer open to join.");
      expect(await sql`select id from fkh_challenge_entries where challenge_id=${id}`).toHaveLength(
        0,
      );
      actor.id = ids[0];
      await expect(inviteFriendToChallenge(id, ids[1])).rejects.toThrow(
        "This challenge is no longer open to invitations.",
      );
      expect(await sql`select id from fkh_challenge_invites where challenge_id=${id}`).toHaveLength(
        0,
      );
      actor.id = ids[1];
    }
    for (const [startsAt, endsAt] of [
      [new Date("2026-09-10"), new Date("2026-09-09")],
      [new Date("2026-09-10"), new Date("2026-09-10")],
      [new Date("invalid"), new Date("2026-09-10")],
    ]) {
      await expect(
        createChallenge({
          templateId,
          title: "Invalid dates",
          visibility: "public",
          startsAt,
          endsAt,
        }),
      ).rejects.toThrow(/Challenge dates/);
    }
    expect(await sql`select id from fkh_challenges where creator_user_id=${actor.id}`).toHaveLength(
      0,
    );
    const openId = (
      await sql`insert into fkh_challenges(template_id,creator_user_id,title,visibility,status,starts_at,ends_at) values(${templateId},${ids[0]},'Synthetic open invitation','public','open',now(),now()+interval '1 day') returning id`
    )[0].id;
    await expect(inviteFriendToChallenge(openId, ids[0])).rejects.toThrow(
      "Only the challenge creator can invite friends.",
    );
    actor.id = ids[0];
    await inviteFriendToChallenge(openId, ids[1]);
    await inviteFriendToChallenge(openId, ids[1]);
    const invitations =
      await sql`select invitee_user_id,status from fkh_challenge_invites where challenge_id=${openId}`;
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({ invitee_user_id: ids[1], status: "pending" });
  });
  it("updates the joined leaderboard from eligible imported shots and removes a departed entrant", async () => {
    ids = (
      await sql`insert into fkh_users(name) values('Synthetic challenge creator'),('Synthetic challenger') returning id`
    ).map((r) => r.id);
    actor.id = ids[1];
    templateId = (
      await sql`insert into fkh_challenge_templates(slug,name,description,challenge_type,rules_json) values(${crypto.randomUUID()},'Synthetic long drive','Fixture','longest_drive','{"minShots":1,"clubTypes":["driver"]}'::jsonb) returning id`
    )[0].id;
    const challengeId = (
      await sql`insert into fkh_challenges(template_id,creator_user_id,title,visibility,starts_at) values(${templateId},${ids[0]},'Synthetic challenge','public',now()-interval '1 day') returning id`
    )[0].id;
    await joinChallenge(challengeId);
    await joinChallenge(challengeId);
    expect((await getChallengeDetailData(challengeId))?.entries).toHaveLength(1);
    const sessionId = (
      await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'csv','range',now(),'Synthetic evidence') returning id`
    )[0].id;
    const clubId = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${actor.id},'driver','challenge-fixture') returning id`
    )[0].id;
    for (const [distance, status] of [
      [250, "included"],
      [400, "user_excluded"],
    ] as const)
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${actor.id},${sessionId},${clubId},'driver',now(),${distance},${distance},${status},'{}'::jsonb)`;
    await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${actor.id},${sessionId},${clubId},'driver',now()+interval '1 day',999,500,'included','{}'::jsonb)`;
    const simulatedSessionId = (
      await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${actor.id},'course_twin_live','simulated_course',now(),'Synthetic modelled evidence') returning id`
    )[0].id;
    await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,quality_tag,review_status,source_raw_json) values(${actor.id},${simulatedSessionId},${clubId},'driver',now(),1,999,'modelled','included','{}'::jsonb)`;
    const detail = await getChallengeDetailData(challengeId);
    expect(detail?.attempts[0].attempt.metricValue).toBe(250);
    const before = detail?.results.map(({ result }) => ({
      userId: result.userId,
      score: result.score,
      rank: result.rank,
    }));
    for (let n = 0; n < 25; n++)
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${actor.id},${sessionId},${clubId},'iron',now(),${1000 + n},100,'included','{}'::jsonb)`;
    await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,review_status,source_raw_json) values(${actor.id},${sessionId},${clubId},'driver',now(),2000,'included','{}'::jsonb)`;
    await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${actor.id},${sessionId},${clubId},'driver',now()-interval '3 days',2001,900,'included','{}'::jsonb)`;
    const foreignSession = (
      await sql`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${ids[0]},'csv','range',now(),'Foreign') returning id`
    )[0].id;
    await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${ids[0]},${foreignSession},${clubId},'driver',now(),2002,999,'included','{}'::jsonb)`;
    const first = await getChallengeSourceInspection(challengeId);
    const second = await getChallengeSourceInspection(challengeId, 2);
    expect(first.total).toBe(31);
    expect(first.rows).toHaveLength(24);
    expect(second.rows).toHaveLength(7);
    const inspected = [...first.rows, ...second.rows];
    expect(new Set(inspected.map((row) => row.id)).size).toBe(31);
    expect(inspected.every((row) => row.userId === actor.id)).toBe(true);
    expect(inspected.filter((row) => row.eligible)).toHaveLength(1);
    const reasons = inspected.flatMap((row) => row.reasons).join(" ");
    for (const reason of [
      "review excludes",
      "Modelled",
      "future",
      "before the challenge",
      "Club does not match",
      "measurement is missing",
    ])
      expect(reasons).toContain(reason);
    expect(
      (await getChallengeDetailData(challengeId))?.results.map(({ result }) => ({
        userId: result.userId,
        score: result.score,
        rank: result.rank,
      })),
    ).toEqual(before);
    await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${actor.id},${sessionId},${clubId},'driver',now(),3000,225,'restored','{}'::jsonb)`;
    expect(
      (await getChallengeSourceInspection(challengeId)).rows.find(
        (row) => row.reviewStatus === "restored",
      )?.eligible,
    ).toBe(true);
    await sql`update fkh_challenges set ends_at=now() where id=${challengeId}`;
    expect(
      (await getChallengeSourceInspection(challengeId)).rows
        .flatMap((row) => row.reasons)
        .join(" "),
    ).toContain("after the challenge end");
    actor.id = ids[0];
    const creatorSources = await getChallengeSourceInspection(challengeId);
    expect(creatorSources.total).toBe(1);
    expect(creatorSources.rows[0].reasons).toContain(
      "Join this challenge before your evidence can rank.",
    );
    actor.id = ids[1];
    await sql`update fkh_shots set review_status='user_excluded' where session_id=${sessionId}`;
    expect((await getChallengeDetailData(challengeId))?.attempts).toHaveLength(0);
    await leaveChallenge(challengeId);
    expect((await getChallengeDetailData(challengeId))?.entries).toHaveLength(0);
  });
});
