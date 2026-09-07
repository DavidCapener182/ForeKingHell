import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { NextRequest } from "next/server";
import type { ReactElement } from "react";
import SharedRoundPage, { type SharedRoundData } from "@/app/share/[token]/page";
import { hashShareToken } from "@/lib/share-links";
import { POST as postOfflineRoundEdit } from "@/app/api/offline/round-edits/route";
import {
  OfflineRoundConflict,
  withOfflineRoundPrecondition,
} from "@/lib/offline-round-precondition";
import { closeDb } from "@/db/client";
import { correctShotClub } from "@/lib/shot-club-correction";
import { completePracticePlanFromSelectedImport } from "@/lib/practice-planner";
import { correctShotClubAction } from "@/app/(app)/shots/actions";
import { recordRoundCompletedFeedItem, updateFeedItemVisibility } from "@/lib/social";
const actor = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => actor.userId,
  getOptionalCurrentUserId: async () => actor.userId || null,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/app-surface-server", () => ({ getRequestAppSurface: async () => "companion" }));
vi.mock("@/app/share/[token]/shared-round-companion", () => ({ SharedRoundCompanion: () => null }));
vi.mock("@/lib/achievements/notification-flash", () => ({ setAchievementUnlockFlash: vi.fn() }));
import {
  updateRoundHoleAction,
  updateRoundCourseLinkAction,
  resplitRoundAction,
  updateClubAction,
  completeLiveRoundAction,
  updateRoundContextAction,
  updateShotClubAction,
  createRoundShareLinkAction,
  revokeRoundShareLinkAction,
} from "@/app/rounds/actions";

const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/fkh_redesign"
  ) {
    throw new Error(
      "Correction integration tests require the disposable local fkh_redesign database.",
    );
  }
}

describe.skipIf(!enabled)("club correction with the real database and domain services", () => {
  let sql: ReturnType<typeof postgres>;
  let owner: string;
  let foreign: string;
  let iron: string;
  let wedge: string;
  let foreignClub: string;
  let trigger: string;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  beforeEach(async () => {
    trigger = `correction_test_${Date.now()}`;
    [owner, foreign] = (
      await sql`insert into fkh_users(name) values('Correction fixture owner'),('Correction fixture foreign') returning id`
    ).map((row) => row.id);
    actor.userId = owner;
    [iron, wedge] = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner},'7i','fixture_7i'),(${owner},'pw','fixture_pw') returning id`
    ).map((row) => row.id);
    foreignClub = (
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${foreign},'pw','fixture_pw') returning id`
    )[0].id;
  });
  afterEach(async () => {
    await sql.unsafe(`drop function if exists ${trigger}() cascade`);
    await sql`delete from fkh_courses where created_by_user_id in ${sql([owner, foreign])}`;
    await sql`delete from fkh_users where id in ${sql([owner, foreign])}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });

  async function seedRound(userId = owner, clubId = iron) {
    const card = [
      {
        holeNumber: 1,
        par: 4,
        yards: 350,
        score: 4,
        putts: 1,
        puttsSource: "manual",
        penalties: 1,
        notes: "Retain scoring evidence",
      },
    ];
    const [round] =
      await sql`insert into fkh_sessions(user_id,source,type,play_context,date,raw_csv_text,round_status,scorecard_json)
      values(${userId},'csv','simulated_course','course',now(),'Original CSV','complete',${sql.json(card)}) returning id`;
    const inserted = [];
    for (const [index, carry] of [150, 80].entries()) {
      const [shot] =
        await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,play_context,shot_at,shot_number,course_hole_number,carry_yd,total_yd,side_carry_yd,ball_speed_mph,review_status,review_confidence,source_raw_json)
        values(${userId},${round.id},${clubId},'7i','course',now(),${index + 1},1,${carry},${carry},3,100,'included',0.42,'{"Club":"7 Iron","Side":"3R","fixture":"keep raw"}'::jsonb) returning id`;
      inserted.push(shot.id as string);
    }
    return { sessionId: round.id as string, shotId: inserted[1], otherShotId: inserted[0] };
  }
  const measurements = async (shotId: string) =>
    (
      await sql`select carry_yd,total_yd,side_carry_yd,ball_speed_mph,review_status,review_confidence,source_raw_json from fkh_shots where id=${shotId}`
    )[0];

  function clubEdit(sessionId: string, type: string, clubId = iron) {
    const form = new FormData();
    Object.entries({ sessionId, clubId, clubType: type }).forEach(([key, value]) =>
      form.set(key, value),
    );
    return form;
  }

  it.each([true, false])(
    "advances the saved offline version monotonically with scorecard=%s",
    async (hasScorecard) => {
      const round = await seedRound();
      const future = new Date(Date.now() + 10000);
      await sql`update fkh_sessions set updated_at=${future} where id=${round.sessionId}`;
      if (!hasScorecard)
        await sql`update fkh_sessions set scorecard_json=null where id=${round.sessionId}`;
      const request = (suffix: string) =>
        new NextRequest("http://localhost/api/offline/round-edits", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fkh-offline-owner": owner,
            "x-fkh-offline-operation": `fixture-version-${round.sessionId}-${suffix}`,
          },
          body: JSON.stringify({
            editKind: "shot-club",
            fields: Object.entries({
              sessionId: round.sessionId,
              shotId: round.shotId,
              clubId: wedge,
              expectedUpdatedAt: future.toISOString(),
            }),
          }),
        });
      const saved = await postOfflineRoundEdit(request("first"));
      expect(saved.status).toBe(200);
      const body = await saved.json();
      expect(Date.parse(body.recordVersion)).toBeGreaterThan(future.getTime());
      expect((await postOfflineRoundEdit(request("second"))).status).toBe(409);
      expect(await sql`select id from fkh_shot_review_events where user_id=${owner}`).toHaveLength(
        1,
      );
    },
  );

  it("does not expose another owner's private tee through a stale shared-round link", async () => {
    const round = await seedRound();
    const [course] =
      await sql`insert into fkh_courses(name,created_by_user_id,visibility) values('Private course fixture',${foreign},'private') returning id`;
    const [tee] =
      await sql`insert into fkh_tee_sets(course_id,name,par,yards,course_rating,slope_rating) values(${course.id},'Private member tee',72,6500,73,130) returning id`;
    await sql`update fkh_sessions set course_id=${course.id},tee_set_id=${tee.id} where id=${round.sessionId}`;
    const token = `fixture-share-${round.sessionId}`;
    await sql`insert into fkh_share_links(user_id,token_hash,resource_type,resource_id) values(${owner},${hashShareToken(token)},'round',${round.sessionId})`;
    const element = (await SharedRoundPage({
      params: Promise.resolve({ token }),
    })) as ReactElement<{ round: SharedRoundData }>;
    expect(element.props.round.session).toMatchObject({
      id: round.sessionId,
      teeName: null,
      courseRating: null,
      slopeRating: null,
    });
    expect(element.props.round.totalScore).toBe(4);
    await sql`update fkh_courses set visibility='shared' where id=${course.id}`;
    const shared = (await SharedRoundPage({ params: Promise.resolve({ token }) })) as ReactElement<{
      round: SharedRoundData;
    }>;
    expect(shared.props.round.session).toMatchObject({
      teeName: "Private member tee",
      courseRating: 73,
      slopeRating: 130,
    });
    await sql`update fkh_courses set visibility='private',created_by_user_id=${owner} where id=${course.id}`;
    const owned = (await SharedRoundPage({ params: Promise.resolve({ token }) })) as ReactElement<{
      round: SharedRoundData;
    }>;
    expect(owned.props.round.session.teeName).toBe("Private member tee");
  });

  it("enforces round share creation, revocation, expiry and resource ownership using the public loader", async () => {
    const round = await seedRound();
    const form = new FormData();
    form.set("sessionId", round.sessionId);
    form.set("expiryDays", "1");
    actor.userId = foreign;
    await expect(createRoundShareLinkAction(form)).rejects.toThrow("Round not found");
    expect(await sql`select id from fkh_share_links where user_id=${foreign}`).toHaveLength(0);
    actor.userId = owner;
    const redirectResult = await createRoundShareLinkAction(form).catch(
      (error: { digest?: string }) => error,
    );
    expect(redirectResult?.digest).toContain("NEXT_REDIRECT");
    const destination = redirectResult!.digest!.split(";")[2];
    const token = new URL(destination, "http://localhost").searchParams.get("share")!;
    expect(token.length).toBeGreaterThan(32);
    const [link] =
      await sql`select id,token_hash,expires_at,revoked_at from fkh_share_links where user_id=${owner} and resource_id=${round.sessionId}`;
    expect(link.token_hash).toBe(hashShareToken(token));
    expect(link.token_hash).not.toBe(token);
    expect(link.expires_at.getTime()).toBeGreaterThan(Date.now());
    const load = (value = token) => SharedRoundPage({ params: Promise.resolve({ token: value }) });
    expect(
      ((await load()) as ReactElement<{ round: SharedRoundData }>).props.round.totalScore,
    ).toBe(4);
    await expect(load(link.token_hash)).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
    form.set("shareLinkId", link.id);
    actor.userId = foreign;
    await revokeRoundShareLinkAction(form);
    expect(
      (await sql`select revoked_at from fkh_share_links where id=${link.id}`)[0].revoked_at,
    ).toBeNull();
    actor.userId = owner;
    await revokeRoundShareLinkAction(form);
    await expect(load()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
    await sql`update fkh_share_links set revoked_at=null,expires_at=now()-interval '1 second' where id=${link.id}`;
    await expect(load()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
    await sql`update fkh_share_links set expires_at=null,user_id=${foreign} where id=${link.id}`;
    await expect(load()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
    await sql`update fkh_share_links set user_id=${owner},resource_type='coach_report' where id=${link.id}`;
    await expect(load()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
    await sql`update fkh_share_links set resource_type='round' where id=${link.id}`;
    await sql`delete from fkh_sessions where id=${round.sessionId}`;
    await expect(load()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK");
  });

  it.each(["context", "course", "complete", "hole", "shot", "club", "split"])(
    "checks the queued version inside the %s mutation transaction",
    async (kind) => {
      const round = await seedRound();
      const before = (
        await sql`select updated_at,scorecard_json,notes from fkh_sessions where id=${round.sessionId}`
      )[0];
      const form = clubEdit(round.sessionId, "PW");
      Object.entries({
        roundStatus: "in_progress",
        notes: "Queued overwrite",
        teeSetId: wedge,
        holeNumber: "1",
        score: "5",
        putts: "1",
        penalties: "1",
        shotId: round.shotId,
        "holeCount-1": "0",
      }).forEach(([key, value]) => form.set(key, value));
      const actions = {
        context: updateRoundContextAction,
        course: updateRoundCourseLinkAction,
        complete: completeLiveRoundAction,
        hole: updateRoundHoleAction,
        shot: updateShotClubAction,
        club: updateClubAction,
        split: resplitRoundAction,
      };
      await expect(
        withOfflineRoundPrecondition(
          {
            userId: owner,
            sessionId: round.sessionId,
            expectedVersion: new Date(before.updated_at.getTime() - 1000).toISOString(),
          },
          async () => {
            await actions[kind as keyof typeof actions](form);
          },
        ),
      ).rejects.toBeInstanceOf(OfflineRoundConflict);
      expect(
        (
          await sql`select updated_at,scorecard_json,notes from fkh_sessions where id=${round.sessionId}`
        )[0],
      ).toEqual(before);
      expect(await sql`select id from fkh_shot_review_events where user_id=${owner}`).toHaveLength(
        0,
      );
      expect((await sql`select club_id from fkh_shots where id=${round.shotId}`)[0].club_id).toBe(
        iron,
      );
    },
  );

  it("rejects queued edits from a switched account without creating a ledger claim or revealing the round version", async () => {
    const round = await seedRound();
    const before = (
      await sql`select updated_at,scorecard_json from fkh_sessions where id=${round.sessionId}`
    )[0];
    const request = (headerOwner: string) =>
      new NextRequest("http://localhost/api/offline/round-edits", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fkh-offline-owner": headerOwner,
          "x-fkh-offline-operation": `fixture-account-${round.sessionId}`,
        },
        body: JSON.stringify({
          editKind: "round-hole",
          fields: Object.entries({
            sessionId: round.sessionId,
            expectedUpdatedAt: before.updated_at.toISOString(),
            holeNumber: "1",
            score: "6",
          }),
        }),
      });
    actor.userId = foreign;
    const switched = await postOfflineRoundEdit(request(owner));
    expect(switched.status).toBe(409);
    expect(await sql`select id from fkh_offline_operations where user_id=${foreign}`).toHaveLength(
      0,
    );
    const forged = await postOfflineRoundEdit(request(foreign));
    expect(forged.status).toBe(409);
    expect((await forged.json()).currentVersion).toBeNull();
    actor.userId = "";
    expect((await postOfflineRoundEdit(request(owner))).status).toBe(401);
    expect(
      (
        await sql`select updated_at,scorecard_json from fkh_sessions where id=${round.sessionId}`
      )[0],
    ).toEqual(before);
  });

  it("rejects a queued edit that becomes stale while waiting for a round lock, and replays the accepted operation", async () => {
    const round = await seedRound();
    const version = (
      await sql`select updated_at from fkh_sessions where id=${round.sessionId}`
    )[0].updated_at.toISOString();
    const request = (score: number) =>
      new NextRequest("http://localhost/api/offline/round-edits", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-fkh-offline-owner": owner,
          "x-fkh-offline-operation": `fixture-round-${round.sessionId}-${score}`,
        },
        body: JSON.stringify({
          editKind: "round-hole",
          fields: Object.entries({
            sessionId: round.sessionId,
            expectedUpdatedAt: version,
            holeNumber: "1",
            score: String(score),
            putts: "1",
            penalties: "1",
          }),
        }),
      });
    const observer = postgres(url!, { max: 1 });
    let pending: Promise<Response>[] = [];
    let waiting = 0;
    try {
      await sql.begin(async (lock) => {
        await lock`select id from fkh_sessions where id=${round.sessionId} for update`;
        pending = [postOfflineRoundEdit(request(5)), postOfflineRoundEdit(request(6))];
        const deadline = Date.now() + 5000;
        while (waiting < 2 && Date.now() < deadline) {
          waiting = Number(
            (
              await observer`select count(*) from pg_stat_activity where datname='fkh_redesign' and wait_event_type='Lock' and query like '%fkh_sessions%' and query like '%for update%'`
            )[0].count,
          );
          if (waiting < 2) await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });
      const responses = await Promise.all(pending);
      expect(waiting).toBe(2);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      const accepted = responses.findIndex((response) => response.status === 200);
      const body = await responses[accepted].json();
      const rejected = await responses[1 - accepted].json();
      expect(rejected.code).toBe("offline_edit_conflict");
      const [saved] =
        await sql`select scorecard_json from fkh_sessions where id=${round.sessionId}`;
      expect(saved.scorecard_json[0].score).toBe(accepted + 5);
      const replay = await postOfflineRoundEdit(request(accepted + 5));
      expect(replay.status).toBe(200);
      expect(replay.headers.get("x-fkh-offline-replayed")).toBe("1");
      expect(await replay.json()).toEqual(body);
    } finally {
      await Promise.allSettled(pending);
      await observer.end();
    }
  });

  it("refreshes every round and stock after a whole-club edit, preserving raw values and retry audits", async () => {
    const rounds = [await seedRound(), await seedRound()];
    const raw = await measurements(rounds[1].shotId);
    await updateClubAction(clubEdit(rounds[0].sessionId, "PW"));
    expect((await sql`select type,normalized_club_key from fkh_clubs where id=${iron}`)[0]).toEqual(
      { type: "pw", normalized_club_key: "pw:generic:generic" },
    );
    for (const round of rounds) {
      expect(
        (
          await sql`select club_id,club_type,shot_category from fkh_shots where id=${round.shotId}`
        )[0],
      ).toEqual({ club_id: iron, club_type: "pw", shot_category: "pitch" });
      expect(
        await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.sessionId}`,
      ).toHaveLength(2);
      expect(
        (await sql`select scorecard_json from fkh_sessions where id=${round.sessionId}`)[0]
          .scorecard_json[0],
      ).toMatchObject({ score: 4, putts: 1, penalties: 1 });
    }
    expect(await measurements(rounds[1].shotId)).toEqual(raw);
    expect(
      (await sql`select sample_size from fkh_stock_yardages where club_id=${iron}`)[0].sample_size,
    ).toBe(2);
    await updateClubAction(clubEdit(rounds[0].sessionId, "PW"));
    expect(await sql`select id from fkh_shot_review_events where user_id=${owner}`).toHaveLength(4);
  });

  it("merges into an owned matching club, preserves foreign evidence and serializes a simultaneous correction", async () => {
    const round = await seedRound();
    const foreignRound = await seedRound(foreign, foreignClub);
    await sql`update fkh_clubs set normalized_club_key='pw:generic:generic',active=false where id in ${sql([wedge, foreignClub])}`;
    await Promise.all([
      updateClubAction(clubEdit(round.sessionId, "PW")),
      correctShotClub({ userId: owner, shotId: round.shotId, clubId: wedge }),
    ]);
    expect(
      await sql`select club_id,club_type from fkh_shots where session_id=${round.sessionId}`,
    ).toEqual([
      { club_id: wedge, club_type: "pw" },
      { club_id: wedge, club_type: "pw" },
    ]);
    expect((await sql`select active from fkh_clubs where id=${iron}`)[0].active).toBe(false);
    expect((await sql`select active from fkh_clubs where id=${wedge}`)[0].active).toBe(true);
    expect(
      (await sql`select club_id,club_type from fkh_shots where id=${foreignRound.shotId}`)[0],
    ).toEqual({ club_id: foreignClub, club_type: "7i" });
    await updateClubAction(clubEdit(round.sessionId, "PW"));
    expect(await sql`select id from fkh_shot_review_events where user_id=${owner}`).toHaveLength(2);
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.sessionId}`,
    ).toHaveLength(2);
    await expect(updateClubAction(clubEdit(round.sessionId, "9i", foreignClub))).rejects.toThrow(
      "Club not found",
    );
    actor.userId = foreign;
    await expect(updateClubAction(clubEdit(round.sessionId, "9i"))).rejects.toThrow(
      "Round not found",
    );
  });

  it("rolls back the entire bulk edit when a later round's derived write fails", async () => {
    const first = await seedRound();
    const second = await seedRound();
    await correctShotClub({ userId: owner, ...first, clubId: iron });
    await correctShotClub({ userId: owner, ...second, clubId: iron });
    const before =
      await sql`select id,scorecard_json,updated_at from fkh_sessions where user_id=${owner} order by id`;
    const events =
      await sql`select id,metadata_json from fkh_strokes_gained_shot_events where user_id=${owner} order by id`;
    const laterId = before[1].id;
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.session_id='${laterId}'::uuid then raise exception 'bulk derived failure'; end if; return NEW; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_strokes_gained_shot_events for each row execute function ${trigger}()`,
    );
    await expect(updateClubAction(clubEdit(first.sessionId, "PW"))).rejects.toThrow();
    expect(
      await sql`select id,scorecard_json,updated_at from fkh_sessions where user_id=${owner} order by id`,
    ).toEqual(before);
    expect(
      await sql`select id,metadata_json from fkh_strokes_gained_shot_events where user_id=${owner} order by id`,
    ).toEqual(events);
    expect((await sql`select type,normalized_club_key from fkh_clubs where id=${iron}`)[0]).toEqual(
      { type: "7i", normalized_club_key: "fixture_7i" },
    );
    expect(await sql`select id from fkh_shot_review_events where user_id=${owner}`).toHaveLength(0);
    expect(await sql`select distinct club_type from fkh_shots where user_id=${owner}`).toEqual([
      { club_type: "7i" },
    ]);
  });

  it("preserves an item's chosen audience on completion replay and rejects foreign audience edits", async () => {
    const round = await seedRound();
    const completion = {
      userId: owner,
      sessionId: round.sessionId,
      courseName: "Fixture course",
      score: 4,
      source: "manual",
    };
    await recordRoundCompletedFeedItem(completion);
    const [original] =
      await sql`select id,visibility,created_at from fkh_feed_items where user_id=${owner} and source_id=${round.sessionId}`;
    expect(original.visibility).toBe("private");
    await sql`update fkh_user_profiles set feed_visibility_default='public' where user_id=${owner}`;
    await recordRoundCompletedFeedItem({ ...completion, score: 5 });
    expect(
      await sql`select id,visibility,created_at,metric_value from fkh_feed_items where user_id=${owner} and source_id=${round.sessionId}`,
    ).toEqual([{ ...original, metric_value: "5" }]);

    await updateFeedItemVisibility(original.id, "friends");
    await Promise.all([
      recordRoundCompletedFeedItem({ ...completion, score: 6 }),
      recordRoundCompletedFeedItem({ ...completion, score: 6 }),
    ]);
    expect(
      await sql`select id,visibility,created_at,metric_value from fkh_feed_items where user_id=${owner} and source_id=${round.sessionId}`,
    ).toEqual([{ ...original, visibility: "friends", metric_value: "6" }]);
    actor.userId = foreign;
    await expect(updateFeedItemVisibility(original.id, "public")).rejects.toThrow(
      "Feed item not found",
    );
    expect(
      (await sql`select visibility from fkh_feed_items where id=${original.id}`)[0].visibility,
    ).toBe("friends");
  });

  it("refreshes mapped round/stock evidence, preserves raw/manual values, and retries without duplicate events", async () => {
    const round = await seedRound();
    const confidence = {
      alignment: "misaligned",
      directionReviews: { [round.shotId]: { status: "questionable", source: "user" } },
    };
    await sql`update fkh_sessions set data_confidence_json=${sql.json(confidence)} where id=${round.sessionId}`;
    const raw = await measurements(round.shotId);
    const result = await correctShotClub({
      userId: owner,
      ...round,
      clubId: wedge,
      expectedSessionId: round.sessionId,
    });
    expect(result).toEqual({ sessionId: round.sessionId, previousClubId: iron });
    expect(
      (
        await sql`select club_id,club_type,shot_category from fkh_shots where id=${round.shotId}`
      )[0],
    ).toEqual({ club_id: wedge, club_type: "pw", shot_category: "pitch" });
    expect(await measurements(round.shotId)).toEqual(raw);
    expect(
      (
        await sql`select scorecard_json,raw_csv_text from fkh_sessions where id=${round.sessionId}`
      )[0],
    ).toMatchObject({
      raw_csv_text: "Original CSV",
      scorecard_json: [
        expect.objectContaining({
          score: 4,
          putts: 1,
          puttsSource: "manual",
          penalties: 1,
          notes: "Retain scoring evidence",
          csvShotCount: 2,
        }),
      ],
    });
    const events =
      await sql`select shot_id,metadata_json from fkh_strokes_gained_shot_events where session_id=${round.sessionId}`;
    expect(events).toHaveLength(2);
    expect(events.find((row) => row.shot_id === round.shotId)?.metadata_json).toMatchObject({
      clubType: "pw",
      shotCategory: "pitch",
    });
    expect(
      (await sql`select data_confidence_json from fkh_sessions where id=${round.sessionId}`)[0]
        .data_confidence_json,
    ).toEqual(confidence);
    const stock =
      await sql`select club_id,sample_size,dispersion_left_yd,dispersion_right_yd from fkh_stock_yardages where user_id=${owner}`;
    expect(stock).toHaveLength(2);
    expect(stock.find((row) => row.club_id === wedge)?.sample_size).toBe(0);
    expect(stock.find((row) => row.club_id === iron)).toMatchObject({
      sample_size: 1,
      dispersion_left_yd: null,
      dispersion_right_yd: null,
    });
    await correctShotClub({ userId: owner, ...round, clubId: wedge });
    expect(
      await sql`select id from fkh_shot_review_events where shot_id=${round.shotId}`,
    ).toHaveLength(1);
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.sessionId}`,
    ).toHaveLength(2);
    await correctShotClub({ userId: owner, ...round, clubId: iron });
    expect(
      (await sql`select club_id,shot_category from fkh_shots where id=${round.shotId}`)[0],
    ).toMatchObject({ club_id: iron, shot_category: "approach" });
    expect(await measurements(round.shotId)).toEqual(raw);
  });

  it("rolls back club, audit, scorecard and derived events together when a derived write fails", async () => {
    const round = await seedRound();
    await correctShotClub({ userId: owner, ...round, clubId: iron });
    const before = (
      await sql`select scorecard_json,updated_at from fkh_sessions where id=${round.sessionId}`
    )[0];
    const events =
      await sql`select * from fkh_strokes_gained_shot_events where session_id=${round.sessionId} order by id`;
    const stock = await sql`select * from fkh_stock_yardages where user_id=${owner} order by id`;
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.session_id='${round.sessionId}'::uuid then raise exception 'deliberate SG rejection'; end if; return new; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_strokes_gained_shot_events for each row execute function ${trigger}()`,
    );
    await expect(correctShotClub({ userId: owner, ...round, clubId: wedge })).rejects.toThrow();
    expect((await sql`select club_id from fkh_shots where id=${round.shotId}`)[0].club_id).toBe(
      iron,
    );
    expect(
      (
        await sql`select scorecard_json,updated_at from fkh_sessions where id=${round.sessionId}`
      )[0],
    ).toEqual(before);
    expect(
      await sql`select * from fkh_strokes_gained_shot_events where session_id=${round.sessionId} order by id`,
    ).toEqual(events);
    expect(await sql`select * from fkh_stock_yardages where user_id=${owner} order by id`).toEqual(
      stock,
    );
    expect(
      await sql`select id from fkh_shot_review_events where shot_id=${round.shotId}`,
    ).toHaveLength(0);
    await sql.unsafe(`drop function ${trigger}() cascade`);
    await correctShotClub({ userId: owner, ...round, clubId: wedge });
    expect((await sql`select club_id from fkh_shots where id=${round.shotId}`)[0].club_id).toBe(
      wedge,
    );
  });

  it("rejects foreign clubs, foreign shots, wrong session membership and invalid IDs without writing", async () => {
    const round = await seedRound();
    const other = await seedRound(foreign, foreignClub);
    await expect(correctShotClub({ userId: owner, ...round, clubId: foreignClub })).rejects.toThrow(
      "unavailable",
    );
    await expect(correctShotClub({ userId: owner, ...other, clubId: wedge })).rejects.toThrow(
      "not found",
    );
    await expect(
      correctShotClub({
        userId: owner,
        ...round,
        clubId: wedge,
        expectedSessionId: other.sessionId,
      }),
    ).rejects.toThrow("not found");
    await expect(
      correctShotClub({ userId: owner, shotId: "invalid", clubId: wedge }),
    ).rejects.toThrow("Choose a shot");
    expect((await sql`select club_id from fkh_shots where id=${round.shotId}`)[0].club_id).toBe(
      iron,
    );
    expect((await sql`select club_id from fkh_shots where id=${other.shotId}`)[0].club_id).toBe(
      foreignClub,
    );
    expect(
      await sql`select id from fkh_shot_review_events where user_id in ${sql([owner, foreign])}`,
    ).toHaveLength(0);
  });

  it("refreshes linked practice results and keeps retry results unique", async () => {
    const round = await seedRound();
    const [plan] =
      await sql`insert into fkh_practice_plans(user_id,source_session_id,session_type,ball_count,time_minutes,energy_level,intent,focus_clubs_json,title,generated_summary,status,planned_at,started_at)
      values(${owner},${round.sessionId},'range',2,10,'normal','confidence','["7i"]'::jsonb,'Two-shot control fixture','Practice fixture','analysed',now(),now()) returning id`;
    await sql`insert into fkh_practice_blocks(practice_plan_id,user_id,block_order,block_type,title,clubs_json,ball_count,time_minutes,goal,drill,success_criteria,record_prompt)
      values(${plan.id},${owner},1,'technical','Iron control','["7i"]'::jsonb,2,10,'Control start line','Hit two shots','Repeat start line','Record notes')`;
    const initial = await completePracticePlanFromSelectedImport(owner, plan.id, round.sessionId);
    expect(initial).not.toBeNull();
    expect(initial!.comparison.decisions[0].actualBalls).toBe(2);
    await correctShotClub({ userId: owner, ...round, clubId: wedge });
    const [result] =
      await sql`select id,comparison_json from fkh_practice_results where practice_plan_id=${plan.id}`;
    expect(result.comparison_json.planVsActual.actualClubs).toEqual(
      expect.arrayContaining(["7i", "pw"]),
    );
    expect(result.comparison_json.decisions[0].actualBalls).toBe(1);
    expect(result.comparison_json.decisions[0].linkedShotIds).toEqual([round.otherShotId]);
    await correctShotClub({ userId: owner, ...round, clubId: wedge });
    expect(
      await sql`select id from fkh_practice_results where practice_plan_id=${plan.id}`,
    ).toEqual([{ id: result.id }]);
    expect(
      await sql`select id from fkh_practice_block_results where practice_result_id=${result.id}`,
    ).toHaveLength(1);
    expect(
      await sql`select id from fkh_practice_plan_matches where practice_plan_id=${plan.id} and accepted=true`,
    ).toHaveLength(1);
    await updateClubAction(clubEdit(round.sessionId, "9i"));
    const [afterBulk] =
      await sql`select id,comparison_json from fkh_practice_results where practice_plan_id=${plan.id}`;
    expect(afterBulk.id).toBe(result.id);
    expect(afterBulk.comparison_json.decisions[0].actualBalls).toBe(0);
    expect(afterBulk.comparison_json.planVsActual.actualClubs).toEqual(
      expect.arrayContaining(["9i", "pw"]),
    );
  });

  it.each(["single", "bulk"] as const)(
    "returns saved plus a warning when %s club practice refresh fails, then repairs on retry",
    async (kind) => {
      const round = await seedRound();
      const [plan] =
        await sql`insert into fkh_practice_plans(user_id,source_session_id,session_type,ball_count,time_minutes,energy_level,intent,focus_clubs_json,title,generated_summary,status,planned_at,started_at)
      values(${owner},${round.sessionId},'range',2,10,'normal','confidence','["7i"]'::jsonb,'Refresh failure fixture','Practice fixture','analysed',now(),now()) returning id`;
      await sql`insert into fkh_practice_blocks(practice_plan_id,user_id,block_order,block_type,title,clubs_json,ball_count,time_minutes,goal,drill,success_criteria,record_prompt)
      values(${plan.id},${owner},1,'technical','Iron control','["7i"]'::jsonb,2,10,'Control start line','Hit two shots','Repeat start line','Record notes')`;
      await completePracticePlanFromSelectedImport(owner, plan.id, round.sessionId);
      await sql.unsafe(
        `create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.practice_plan_id='${plan.id}'::uuid then raise exception 'practice refresh failure'; end if; return NEW; end $$`,
      );
      await sql.unsafe(
        `create trigger ${trigger} before insert or update on fkh_practice_results for each row execute function ${trigger}()`,
      );
      const save = () =>
        kind === "single"
          ? correctShotClubAction(round.shotId, wedge)
          : updateClubAction(clubEdit(round.sessionId, "PW"));
      const saved = await save();
      expect(saved.warning).toContain("Club saved");
      expect(
        (await sql`select club_type from fkh_shots where id=${round.shotId}`)[0].club_type,
      ).toBe("pw");
      if (kind === "single") expect(saved).toMatchObject({ previousClubId: iron });
      expect(
        (
          await sql`select comparison_json from fkh_practice_results where practice_plan_id=${plan.id}`
        )[0].comparison_json.decisions[0].actualBalls,
      ).toBe(2);
      await sql.unsafe(`drop function ${trigger}() cascade`);
      expect((await save()).warning).toBeUndefined();
      expect(
        (
          await sql`select comparison_json from fkh_practice_results where practice_plan_id=${plan.id}`
        )[0].comparison_json.decisions[0].actualBalls,
      ).toBe(kind === "single" ? 1 : 0);
      expect(await sql`select id from fkh_shot_review_events where user_id=${owner}`).toHaveLength(
        kind === "single" ? 1 : 2,
      );
      if (kind === "single") {
        if (!("previousClubId" in saved) || typeof saved.previousClubId !== "string") {
          throw new Error("Saved single-shot correction must retain its Undo club.");
        }
        const previousClubId = saved.previousClubId;
        await correctShotClubAction(round.shotId, previousClubId);
        expect((await sql`select club_id from fkh_shots where id=${round.shotId}`)[0].club_id).toBe(
          iron,
        );
        expect(
          (
            await sql`select comparison_json from fkh_practice_results where practice_plan_id=${plan.id}`
          )[0].comparison_json.decisions[0].actualBalls,
        ).toBe(2);
      }
    },
  );

  it("rebuilds Strokes Gained after score and tee corrections and rolls back failed recalculation", async () => {
    const round = await seedRound();
    await correctShotClub({ userId: owner, ...round, clubId: iron });
    const [publication] =
      await sql`insert into fkh_feed_items(user_id,item_type,headline,metric_value,source_id,dedupe_key,visibility,created_at)
      values(${owner},'round_completed','My saved round','4',${round.sessionId},${"round-completed:" + round.sessionId},'friends','2026-09-01T12:00:00Z') returning id,created_at`;
    const [foreignPublication] =
      await sql`insert into fkh_feed_items(user_id,item_type,headline,metric_value,source_id,dedupe_key,visibility)
      values(${foreign},'round_completed','Other account record','99',${round.sessionId},${"round-completed:" + round.sessionId},'private') returning id`;
    const holeForm = new FormData();
    Object.entries({
      sessionId: round.sessionId,
      holeNumber: "1",
      score: "5",
      putts: "2",
      penalties: "1",
    }).forEach(([key, value]) => holeForm.set(key, value));
    await updateRoundHoleAction(holeForm);
    expect(
      (
        await sql`select headline,metric_value,visibility,created_at from fkh_feed_items where id=${publication.id}`
      )[0],
    ).toEqual({
      headline: "My saved round",
      metric_value: "5",
      visibility: "friends",
      created_at: publication.created_at,
    });
    expect(
      (await sql`select metric_value from fkh_feed_items where id=${foreignPublication.id}`)[0]
        .metric_value,
    ).toBe("99");
    expect(
      (
        await sql`select metadata_json from fkh_strokes_gained_shot_events where shot_id=${round.shotId}`
      )[0].metadata_json,
    ).toMatchObject({ scorecardScore: 5, inferredPuttsAfterShot: 2 });
    const before = (
      await sql`select scorecard_json from fkh_sessions where id=${round.sessionId}`
    )[0];
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.session_id='${round.sessionId}'::uuid then raise exception 'deliberate derived correction rejection'; end if; return new; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_strokes_gained_shot_events for each row execute function ${trigger}()`,
    );
    holeForm.set("score", "6");
    await expect(updateRoundHoleAction(holeForm)).rejects.toThrow();
    expect(
      (await sql`select metric_value from fkh_feed_items where id=${publication.id}`)[0]
        .metric_value,
    ).toBe("5");
    expect(
      (await sql`select scorecard_json from fkh_sessions where id=${round.sessionId}`)[0],
    ).toEqual(before);
    await sql.unsafe(`drop function ${trigger}() cascade`);
    const [course] =
      await sql`insert into fkh_courses(name,created_by_user_id,visibility) values('Synthetic correction course',${owner},'private') returning id`;
    const [tee] =
      await sql`insert into fkh_tee_sets(course_id,name,par,yards) values(${course.id},'Fixture tees',4,450) returning id`;
    await sql`insert into fkh_holes(course_id,tee_set_id,hole_number,par,yards,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson)
      values(${course.id},${tee.id},1,4,450,0,0,0,0,'{"type":"LineString","coordinates":[[0,0],[0,0]]}'::jsonb)`;
    const teeForm = new FormData();
    teeForm.set("sessionId", round.sessionId);
    teeForm.set("teeSetId", tee.id);
    await updateRoundCourseLinkAction(teeForm);
    expect(
      (
        await sql`select metric_label,context,visibility from fkh_feed_items where id=${publication.id}`
      )[0],
    ).toEqual({
      metric_label: "Synthetic correction course",
      context: "Synthetic correction course",
      visibility: "friends",
    });
    expect(
      (
        await sql`select start_distance_yd from fkh_strokes_gained_shot_events where shot_id=${round.otherShotId}`
      )[0].start_distance_yd,
    ).toBe(450);
    expect(
      (await sql`select scorecard_json from fkh_sessions where id=${round.sessionId}`)[0]
        .scorecard_json[0],
    ).toMatchObject({ yards: 450, score: 5, putts: 2 });
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.sessionId}`,
    ).toHaveLength(2);
  });

  it("preserves explicit hole splits and unassigned shots through later recalculation", async () => {
    const round = await seedRound();
    await sql`update fkh_sessions set scorecard_json=scorecard_json || '[{"holeNumber":2,"par":3,"yards":120,"name":null,"score":4,"putts":1,"puttsSource":"manual","penalties":1}]'::jsonb where id=${round.sessionId}`;
    await sql`update fkh_shots set review_status='user_excluded' where id=${round.otherShotId}`;
    const raw = await measurements(round.otherShotId);
    const form = new FormData();
    Object.entries({ sessionId: round.sessionId, "holeCount-1": "0", "holeCount-2": "2" }).forEach(
      ([key, value]) => form.set(key, value),
    );
    await resplitRoundAction(form);
    expect(
      await sql`select id from fkh_shots where session_id=${round.sessionId} and course_hole_number=2`,
    ).toHaveLength(2);
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.sessionId} and hole_number=2`,
    ).toHaveLength(2);
    expect(
      (await sql`select scorecard_json from fkh_sessions where id=${round.sessionId}`)[0]
        .scorecard_json,
    ).toEqual([
      expect.objectContaining({
        holeNumber: 1,
        csvShotCount: 0,
        putts: 1,
        shotAssignmentSource: "manual",
      }),
      expect.objectContaining({
        holeNumber: 2,
        csvShotCount: 2,
        putts: 1,
        shotAssignmentSource: "manual",
      }),
    ]);
    expect(await measurements(round.otherShotId)).toEqual(raw);
    form.set("holeCount-2", "0");
    await resplitRoundAction(form);
    await correctShotClub({ userId: owner, ...round, clubId: iron });
    expect(
      await sql`select id from fkh_shots where session_id=${round.sessionId} and course_hole_number is null and course_hole_shot_number is null and distance_remaining_yd is null`,
    ).toHaveLength(2);
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.sessionId} and shot_id is not null`,
    ).toHaveLength(0);
    expect(await measurements(round.otherShotId)).toEqual(raw);
  });

  it("rejects invalid split counts and rolls back every hole assignment on failure", async () => {
    const round = await seedRound();
    await correctShotClub({ userId: owner, ...round, clubId: iron });
    const form = new FormData();
    form.set("sessionId", round.sessionId);
    for (const invalid of ["", "-1", "1.5", "13", "3"]) {
      form.set("holeCount-1", invalid);
      await expect(resplitRoundAction(form)).rejects.toThrow();
    }
    const before = (
      await sql`select scorecard_json,updated_at from fkh_sessions where id=${round.sessionId}`
    )[0];
    const events =
      await sql`select * from fkh_strokes_gained_shot_events where session_id=${round.sessionId} order by id`;
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.session_id='${round.sessionId}'::uuid then raise exception 'deliberate split rejection'; end if; return new; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_strokes_gained_shot_events for each row execute function ${trigger}()`,
    );
    form.set("holeCount-1", "1");
    await expect(resplitRoundAction(form)).rejects.toThrow();
    expect(
      (
        await sql`select scorecard_json,updated_at from fkh_sessions where id=${round.sessionId}`
      )[0],
    ).toEqual(before);
    expect(
      await sql`select id from fkh_shots where session_id=${round.sessionId} and course_hole_number=1`,
    ).toHaveLength(2);
    expect(
      await sql`select * from fkh_strokes_gained_shot_events where session_id=${round.sessionId} order by id`,
    ).toEqual(events);
    actor.userId = foreign;
    await expect(resplitRoundAction(form)).rejects.toThrow("not found");
  });

  it("serializes concurrent corrections within a round without losing either shot", async () => {
    const round = await seedRound();
    await Promise.all([
      correctShotClub({ userId: owner, shotId: round.shotId, clubId: wedge }),
      correctShotClub({ userId: owner, shotId: round.otherShotId, clubId: wedge }),
    ]);
    expect(
      await sql`select id from fkh_shots where session_id=${round.sessionId} and club_id=${wedge}`,
    ).toHaveLength(2);
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.sessionId}`,
    ).toHaveLength(2);
    expect(await sql`select id from fkh_shot_review_events where user_id=${owner}`).toHaveLength(2);
    expect(
      (await sql`select scorecard_json from fkh_sessions where id=${round.sessionId}`)[0]
        .scorecard_json[0].putts,
    ).toBe(1);
  });
});
