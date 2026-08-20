import { randomUUID } from "node:crypto";

import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the live shot-review persona check.");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const fixture = {
  ownerId: randomUUID(),
  strangerId: randomUUID(),
  clubId: randomUUID(),
  sessionId: randomUUID(),
  importFileId: randomUUID(),
  shotId: randomUUID(),
};
let evidence;

try {
  await sql.begin(async (tx) => {
    await tx`
      insert into fkh_users (id, email, name)
      values
        (${fixture.ownerId}, ${`shot-owner-${fixture.ownerId}@example.invalid`}, 'Shot lifecycle owner'),
        (${fixture.strangerId}, ${`shot-stranger-${fixture.strangerId}@example.invalid`}, 'Shot lifecycle stranger')
    `;
    await tx`
      insert into fkh_clubs (id, user_id, type, normalized_club_key)
      values (${fixture.clubId}, ${fixture.ownerId}, 'Driver', ${`rollback-driver-${fixture.clubId}`})
    `;
    await tx`
      insert into fkh_sessions (
        id, user_id, source, type, play_context, date, raw_csv_hash, raw_csv_text
      ) values (
        ${fixture.sessionId}, ${fixture.ownerId}, 'csv', 'practice', 'range', now(),
        ${fixture.sessionId.replaceAll("-", "").padEnd(64, "0").slice(0, 64)},
        'Club,Carry Distance\nDriver,241'
      )
    `;
    await tx`
      insert into fkh_import_files (
        id, user_id, session_id, source, play_context, file_name, raw_csv_hash, status
      ) values (
        ${fixture.importFileId}, ${fixture.ownerId}, ${fixture.sessionId}, 'csv', 'range',
        'rollback-shot-review.csv',
        ${fixture.importFileId.replaceAll("-", "").padEnd(64, "0").slice(0, 64)},
        'saved'
      )
    `;
    await tx`
      insert into fkh_shots (
        id, user_id, session_id, club_id, play_context, shot_at, club_type, shot_number,
        carry_yd, quality_tag, source_raw_json
      ) values (
        ${fixture.shotId}, ${fixture.ownerId}, ${fixture.sessionId}, ${fixture.clubId}, 'range',
        now(), 'driver', 1, 241, 'normal', ${sql.json({ rawCarry: "241", marker: "preserved" })}
      )
    `;

    async function asAuthenticated(userId, operation) {
      await tx.unsafe("reset role");
      await tx.unsafe("set local role authenticated");
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      return operation();
    }

    const ownerRows = await asAuthenticated(
      fixture.ownerId,
      () => tx`
        select
          (select count(*)::int from fkh_sessions where id = ${fixture.sessionId}) as sessions,
          (select count(*)::int from fkh_import_files where id = ${fixture.importFileId}) as imports,
          (select count(*)::int from fkh_shots where id = ${fixture.shotId}) as shots
      `,
    );
    const strangerRows = await asAuthenticated(
      fixture.strangerId,
      () => tx`
        select
          (select count(*)::int from fkh_sessions where id = ${fixture.sessionId}) as sessions,
          (select count(*)::int from fkh_import_files where id = ${fixture.importFileId}) as imports,
          (select count(*)::int from fkh_shots where id = ${fixture.shotId}) as shots
      `,
    );

    await tx.unsafe("reset role");
    const [privileges] = await tx`
      select
        has_table_privilege('authenticated', 'public.fkh_shots', 'INSERT') as shot_insert,
        has_table_privilege('authenticated', 'public.fkh_shots', 'UPDATE') as shot_update,
        has_table_privilege('authenticated', 'public.fkh_shots', 'DELETE') as shot_delete,
        has_table_privilege('authenticated', 'public.fkh_shot_review_events', 'INSERT') as event_insert
    `;

    await tx`
      update fkh_shots
      set
        review_status = 'user_excluded',
        review_reason = 'Rollback-only authenticated lifecycle proof.',
        review_confidence = 1,
        review_source = 'user',
        review_previous_quality_tag = quality_tag,
        quality_tag = 'exclude:rollback-proof',
        reviewed_at = now()
      where id = ${fixture.shotId} and user_id = ${fixture.ownerId}
    `;
    await tx`
      insert into fkh_shot_review_events (
        user_id, shot_id, previous_status, status, reason, confidence, source,
        previous_quality_tag, resulting_quality_tag
      ) values (
        ${fixture.ownerId}, ${fixture.shotId}, 'included', 'user_excluded',
        'Rollback-only authenticated lifecycle proof.', 1, 'user', 'normal',
        'exclude:rollback-proof'
      )
    `;
    const excludedRows = await asAuthenticated(
      fixture.ownerId,
      () => tx`
        select review_status, quality_tag, review_previous_quality_tag, source_raw_json
        from fkh_shots where id = ${fixture.shotId}
      `,
    );

    await tx.unsafe("reset role");
    await tx`
      update fkh_shots
      set
        review_status = 'restored',
        review_reason = 'Rollback-only restore proof.',
        review_confidence = 1,
        review_source = 'user',
        quality_tag = review_previous_quality_tag,
        review_previous_quality_tag = null,
        reviewed_at = now()
      where id = ${fixture.shotId} and user_id = ${fixture.ownerId}
    `;
    await tx`
      insert into fkh_shot_review_events (
        user_id, shot_id, previous_status, status, reason, confidence, source,
        previous_quality_tag, resulting_quality_tag
      ) values (
        ${fixture.ownerId}, ${fixture.shotId}, 'user_excluded', 'restored',
        'Rollback-only restore proof.', 1, 'user', 'exclude:rollback-proof', 'normal'
      )
    `;
    const restoredRows = await asAuthenticated(
      fixture.ownerId,
      () => tx`
        select review_status, quality_tag, review_previous_quality_tag, source_raw_json
        from fkh_shots where id = ${fixture.shotId}
      `,
    );
    const ownerEvents = await asAuthenticated(
      fixture.ownerId,
      () => tx`
        select previous_status, status
        from fkh_shot_review_events
        where shot_id = ${fixture.shotId}
        order by case status when 'user_excluded' then 1 when 'restored' then 2 else 3 end
      `,
    );
    const strangerEvents = await asAuthenticated(
      fixture.strangerId,
      () => tx`select id from fkh_shot_review_events where shot_id = ${fixture.shotId}`,
    );

    evidence = {
      owner: ownerRows[0],
      stranger: strangerRows[0],
      browserMutationPrivileges: privileges,
      excluded: excludedRows[0],
      restored: restoredRows[0],
      ownerEvents,
      strangerEventCount: strangerEvents.length,
      transaction: "rolled-back",
    };

    throw new Error("ROLLBACK_SHOT_REVIEW_PROBE");
  });
} catch (error) {
  if (!(error instanceof Error) || error.message !== "ROLLBACK_SHOT_REVIEW_PROBE") throw error;
} finally {
  await sql.end();
}

const passed =
  evidence?.owner.sessions === 1 &&
  evidence.owner.imports === 1 &&
  evidence.owner.shots === 1 &&
  evidence.stranger.sessions === 0 &&
  evidence.stranger.imports === 0 &&
  evidence.stranger.shots === 0 &&
  !evidence.browserMutationPrivileges.shot_insert &&
  !evidence.browserMutationPrivileges.shot_update &&
  !evidence.browserMutationPrivileges.shot_delete &&
  !evidence.browserMutationPrivileges.event_insert &&
  evidence.excluded.review_status === "user_excluded" &&
  evidence.excluded.quality_tag === "exclude:rollback-proof" &&
  evidence.excluded.review_previous_quality_tag === "normal" &&
  evidence.excluded.source_raw_json?.marker === "preserved" &&
  evidence.restored.review_status === "restored" &&
  evidence.restored.quality_tag === "normal" &&
  evidence.restored.review_previous_quality_tag === null &&
  evidence.restored.source_raw_json?.marker === "preserved" &&
  JSON.stringify(evidence.ownerEvents) ===
    JSON.stringify([
      { previous_status: "included", status: "user_excluded" },
      { previous_status: "user_excluded", status: "restored" },
    ]) &&
  evidence.strangerEventCount === 0 &&
  evidence.transaction === "rolled-back";

if (!passed) {
  console.error(JSON.stringify(evidence));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(evidence));
}
