import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { createScorecardProofToken } from "@/lib/scorecard-proof-token";
import { closeDb } from "@/db/client";
import {
  createTournament,
  joinTournament,
  submitTournamentRound,
  withdrawTournament,
} from "@/lib/tournaments";
import { TOURNAMENT_ENTRY_TERMS_VERSION } from "@/lib/tournament-entry-terms";

const actor = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.userId }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (
    !target ||
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    target.pathname !== "/fkh_redesign"
  )
    throw new Error("Tournament tests require the disposable local fkh_redesign database.");
}
describe.skipIf(!enabled)("tournament participation and saved-round submissions", () => {
  let sql: ReturnType<typeof postgres>;
  let owner: string;
  let organizer: string;
  let tournamentId: string;
  let sessionId: string;
  let trigger: string;
  beforeAll(() => {
    sql = postgres(url!, { max: 1 });
  });
  beforeEach(async () => {
    [owner, organizer] = (
      await sql`insert into fkh_users(name) values('Tournament fixture player'),('Tournament fixture organizer') returning id`
    ).map((row) => row.id);
    actor.userId = owner;
    trigger = `tournament_fixture_${Date.now()}`;
    tournamentId = (
      await sql`insert into fkh_tournaments(title,visibility,created_by_user_id,round_count) values('Disposable tournament','public',${organizer},2) returning id`
    )[0].id;
    const card = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      score: 4,
      netScore: 4,
    }));
    sessionId = (
      await sql`insert into fkh_sessions(user_id,source,type,play_context,date,raw_csv_text,raw_csv_hash,scorecard_json) values(${owner},'csv','round','course',now(),'Synthetic round',${crypto.randomUUID()},${sql.json(card)}) returning id`
    )[0].id;
  });
  afterEach(async () => {
    await sql.unsafe(`drop function if exists ${trigger}() cascade`);
    await sql`delete from fkh_users where id in ${sql([owner, organizer])}`;
  });
  afterAll(async () => {
    await closeDb();
    await sql.end();
  });
  const terms = () => ({
    accepted: true as const,
    acceptedAt: new Date(),
    version: TOURNAMENT_ENTRY_TERMS_VERSION,
  });
  it("rejects reversed creation dates before saving any tournament or rounds", async () => {
    await expect(
      createTournament({
        title: "Invalid dates",
        format: "two_round_open",
        visibility: "public",
        startsAt: new Date("2026-09-10"),
        endsAt: new Date("2026-09-09"),
      }),
    ).rejects.toThrow(/Tournament dates/);
    expect(
      await sql`select id from fkh_tournaments where created_by_user_id=${owner}`,
    ).toHaveLength(0);
  });

  it("rejects a foreign private course and a tee belonging to another course", async () => {
    const courseIds: string[] = [];
    try {
      for (const userId of [organizer, owner])
        courseIds.push(
          (
            await sql`insert into fkh_courses(name,visibility,created_by_user_id) values('Synthetic tournament private course','private',${userId}) returning id`
          )[0].id,
        );
      const teeId = (
        await sql`insert into fkh_tee_sets(course_id,name,par) values(${courseIds[0]},'Synthetic tee',72) returning id`
      )[0].id;
      const base = {
        title: "Synthetic ownership",
        format: "two_round_open" as const,
        visibility: "public",
      };
      await expect(
        createTournament({ ...base, courseId: courseIds[0], teeSetId: teeId }),
      ).rejects.toThrow("Course not found.");
      await expect(
        createTournament({ ...base, courseId: courseIds[1], teeSetId: teeId }),
      ).rejects.toThrow("Tee set not found.");
      expect(
        await sql`select id from fkh_tournaments where created_by_user_id=${owner}`,
      ).toHaveLength(0);
      const ownTee = (
        await sql`insert into fkh_tee_sets(course_id,name,par) values(${courseIds[1]},'Synthetic owned tee',72) returning id`
      )[0].id;
      const ownedId = await createTournament({ ...base, courseId: courseIds[1], teeSetId: ownTee });
      expect(
        (await sql`select course_id,tee_set_id from fkh_tournaments where id=${ownedId}`)[0],
      ).toMatchObject({ course_id: courseIds[1], tee_set_id: ownTee });
      await sql`update fkh_courses set visibility='shared' where id=${courseIds[0]}`;
      const sharedId = await createTournament({ ...base, courseId: courseIds[0], teeSetId: teeId });
      expect(
        (await sql`select course_id,tee_set_id from fkh_tournaments where id=${sharedId}`)[0],
      ).toMatchObject({ course_id: courseIds[0], tee_set_id: teeId });
    } finally {
      await sql`delete from fkh_tournaments where created_by_user_id=${owner}`;
      if (courseIds.length) await sql`delete from fkh_courses where id in ${sql(courseIds)}`;
    }
  });

  it("preserves valid creation dates, round count and proof policy", async () => {
    const startsAt = new Date("2026-09-10T12:00:00Z");
    const endsAt = new Date("2026-09-18T12:00:00Z");
    const id = await createTournament({
      title: "Synthetic valid dates",
      format: "four_round_major",
      visibility: "private",
      startsAt,
      endsAt,
      roundCount: 4,
      directRapsodoRequired: true,
      screenshotRequired: true,
    });
    const [saved] =
      await sql`select starts_at,ends_at,round_count,visibility,direct_rapsodo_required,screenshot_required from fkh_tournaments where id=${id}`;
    expect(saved).toMatchObject({
      starts_at: startsAt,
      ends_at: endsAt,
      round_count: 4,
      visibility: "private",
      direct_rapsodo_required: true,
      screenshot_required: true,
    });
    const rounds =
      await sql`select starts_at,ends_at,round_number from fkh_tournament_rounds where tournament_id=${id} order by round_number`;
    expect(rounds).toHaveLength(4);
    rounds.forEach((round, index) =>
      expect(round).toMatchObject({
        starts_at: startsAt,
        ends_at: endsAt,
        round_number: index + 1,
      }),
    );
  });

  it.each(["closed", "cancelled", "expired"])(
    "rejects %s tournament entry without saving participation",
    async (state) => {
      await sql`update fkh_tournaments set status=${state === "expired" ? "open" : state}, ends_at=${state === "expired" ? new Date(Date.now() - 86400000) : new Date(Date.now() + 86400000)} where id=${tournamentId}`;
      await expect(joinTournament(tournamentId, terms())).rejects.toThrow(/no longer open/);
      expect(
        await sql`select id from fkh_tournament_entries where tournament_id=${tournamentId} and user_id=${owner}`,
      ).toHaveLength(0);
    },
  );

  it("keeps proof usable after rejected entry and rolls proof/submission back when evidence save fails", async () => {
    const token = createScorecardProofToken({
      userId: owner,
      scopeType: "tournament",
      scopeId: tournamentId,
      roundNumber: 1,
      imageHash: "a".repeat(64),
      totalScore: 72,
      courseName: null,
      teeName: null,
      dateIso: null,
    });
    const input = { tournamentId, roundNumber: 1, grossScore: 80, scorecardProofToken: token };
    await expect(submitTournamentRound(input)).rejects.toThrow("Enter the tournament");
    expect(
      (await sql`select count(*) from fkh_scorecard_proof_consumptions where user_id=${owner}`)[0]
        .count,
    ).toBe("0");
    await joinTournament(tournamentId, terms());
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if exists(select 1 from fkh_tournament_submissions where id=NEW.submission_id and tournament_id='${tournamentId}'::uuid) then raise exception 'synthetic evidence failure'; end if; return NEW; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_tournament_evidence for each row when (NEW.submission_id is not null) execute function ${trigger}()`,
    );
    await expect(submitTournamentRound(input)).rejects.toThrow();
    expect(
      (
        await sql`select count(*) from fkh_tournament_submissions where tournament_id=${tournamentId}`
      )[0].count,
    ).toBe("0");
    expect(
      (await sql`select count(*) from fkh_scorecard_proof_consumptions where user_id=${owner}`)[0]
        .count,
    ).toBe("0");
    await sql.unsafe(`drop function ${trigger}() cascade`);
    const id = await submitTournamentRound(input);
    expect(await submitTournamentRound(input)).toBe(id);
    expect(
      (await sql`select gross_score from fkh_tournament_submissions where id=${id}`)[0].gross_score,
    ).toBe(72);
    expect(
      (await sql`select count(*) from fkh_scorecard_proof_consumptions where user_id=${owner}`)[0]
        .count,
    ).toBe("1");
  });

  it("rejects foreign rounds and invalid round indices, but flags reuse in a different round", async () => {
    await joinTournament(tournamentId, terms());
    const input = { tournamentId, sessionId, roundNumber: 1, grossScore: 72 };
    for (const roundNumber of [0, 3, 1.5, NaN])
      await expect(submitTournamentRound({ ...input, roundNumber })).rejects.toThrow(
        "valid tournament round",
      );
    actor.userId = organizer;
    await joinTournament(tournamentId, terms());
    await expect(submitTournamentRound(input)).rejects.toThrow("not found");
    actor.userId = owner;
    const ids = await Promise.all([submitTournamentRound(input), submitTournamentRound(input)]);
    expect(ids[0]).toBe(ids[1]);
    const other = await submitTournamentRound({ ...input, roundNumber: 2 });
    expect(
      (await sql`select metadata_json from fkh_tournament_submissions where id=${other}`)[0]
        .metadata_json.duplicateImport,
    ).toBe(true);
  });

  it("requires current terms and re-evaluates a retry when the event window changes", async () => {
    await expect(joinTournament(tournamentId, { ...terms(), version: "old" })).rejects.toThrow(
      "current tournament",
    );
    expect(
      (
        await sql`select count(*) from fkh_tournament_entries where tournament_id=${tournamentId}`
      )[0].count,
    ).toBe("0");
    await joinTournament(tournamentId, terms());
    const input = { tournamentId, sessionId, roundNumber: 1, grossScore: 72 };
    const id = await submitTournamentRound(input);
    expect(
      (await sql`select verification_status from fkh_tournament_submissions where id=${id}`)[0]
        .verification_status,
    ).toBe("verified");
    await sql`update fkh_tournaments set ends_at=starts_at-interval '1 day' where id=${tournamentId}`;
    expect(await submitTournamentRound(input)).toBe(id);
    expect(
      (await sql`select verification_status from fkh_tournament_submissions where id=${id}`)[0]
        .verification_status,
    ).not.toBe("verified");
  });

  it("keeps out-of-window saved rounds out of verified standings", async () => {
    await joinTournament(tournamentId, terms());
    await sql`update fkh_sessions set date=now()-interval '30 days' where id=${sessionId}`;
    const id = await submitTournamentRound({
      tournamentId,
      sessionId,
      roundNumber: 1,
      grossScore: 72,
    });
    const [submission] =
      await sql`select verification_status,metadata_json from fkh_tournament_submissions where id=${id}`;
    expect(submission.verification_status).not.toBe("verified");
    expect(submission.metadata_json.verificationReasons).toContain("Date outside event window");
    expect(
      (
        await sql`select count(*) from fkh_tournament_standings where tournament_id=${tournamentId} and status='active'`
      )[0].count,
    ).toBe("0");
  });

  it("preserves saved-round evidence and submission identity on retry", async () => {
    await joinTournament(tournamentId, terms());
    await joinTournament(tournamentId, terms());
    expect(
      (
        await sql`select count(*) from fkh_tournament_entries where tournament_id=${tournamentId} and user_id=${owner}`
      )[0].count,
    ).toBe("1");
    const input = { tournamentId, sessionId, roundNumber: 1, grossScore: 999 };
    const first = await submitTournamentRound(input);
    const original = (await sql`select * from fkh_tournament_submissions where id=${first}`)[0];
    const evidenceCount = (
      await sql`select count(*) from fkh_tournament_evidence where submission_id=${first}`
    )[0].count;
    expect(original.gross_score).toBe(72);
    expect(await submitTournamentRound(input)).toBe(first);
    const retried = (await sql`select * from fkh_tournament_submissions where id=${first}`)[0];
    expect(retried.metadata_json.duplicateImport).toBe(false);
    expect(retried.verification_status).toBe(original.verification_status);
    expect(
      (await sql`select count(*) from fkh_tournament_evidence where submission_id=${first}`)[0]
        .count,
    ).toBe(evidenceCount);
    await withdrawTournament(tournamentId);
    await expect(submitTournamentRound(input)).rejects.toThrow("Enter the tournament");
  });
});
