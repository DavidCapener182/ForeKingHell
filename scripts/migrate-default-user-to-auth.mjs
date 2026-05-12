#!/usr/bin/env node
import fs from "node:fs";
import postgres from "postgres";

const DEFAULT_LEGACY_USER_ID = "00000000-0000-0000-0000-000000000001";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const userOwnedColumns = [
  ["fkh_clubs", "user_id"],
  ["fkh_sessions", "user_id"],
  ["fkh_import_rows", "user_id"],
  ["fkh_import_files", "user_id"],
  ["fkh_share_links", "user_id"],
  ["fkh_shots", "user_id"],
  ["fkh_stock_yardages", "user_id"],
  ["fkh_ball_models", "user_id"],
  ["fkh_club_equipment_history", "user_id"],
  ["fkh_strokes_gained_shot_events", "user_id"],
  ["fkh_user_achievements", "user_id"],
  ["fkh_xp_ledger", "user_id"],
  ["fkh_achievement_progress", "user_id"],
  ["fkh_achievement_sync_state", "user_id"],
  ["fkh_rapsodo_sync_sessions", "user_id"],
  ["fkh_courses", "created_by_user_id"],
  ["fkh_account_memberships", "owner_user_id"],
  ["fkh_account_memberships", "member_user_id"],
  ["fkh_account_invitations", "owner_user_id"],
  ["fkh_account_invitations", "accepted_by_user_id"],
];

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
const legacyUserId =
  process.env.LEGACY_USER_ID ?? process.env.DEFAULT_USER_ID ?? DEFAULT_LEGACY_USER_ID;
const targetUserId = process.env.TARGET_AUTH_USER_ID ?? process.env.AUTH_USER_ID;
const targetEmail = process.env.TARGET_AUTH_EMAIL ?? null;
const targetName = process.env.TARGET_AUTH_NAME ?? null;
const dryRun = process.argv.includes("--dry-run");

function loadLocalEnv() {
  if (!fs.existsSync(".env")) {
    return;
  }

  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match || match[1].startsWith("#") || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!targetUserId) {
  throw new Error("TARGET_AUTH_USER_ID is required.");
}

if (!UUID_PATTERN.test(legacyUserId)) {
  throw new Error(`LEGACY_USER_ID/DEFAULT_USER_ID must be a UUID. Received: ${legacyUserId}`);
}

if (!UUID_PATTERN.test(targetUserId)) {
  throw new Error(`TARGET_AUTH_USER_ID must be a UUID. Received: ${targetUserId}`);
}

if (legacyUserId === targetUserId) {
  throw new Error("Legacy and target user IDs are the same; nothing to migrate.");
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  const changes = await sql.begin(async (tx) => {
    const counts = [];

    if (dryRun) {
      for (const [table, column] of userOwnedColumns) {
        const [row] = await tx`
          select count(*)::int as count
          from ${tx(table)}
          where ${tx(column)} = ${legacyUserId}
        `;
        counts.push({ table, column, count: row.count });
      }

      const [missingImportFiles] = await tx`
        select count(*)::int as count
        from fkh_sessions session
        where session.user_id = ${targetUserId}
          and session.raw_csv_hash is not null
          and not exists (
            select 1
            from fkh_import_files import_file
            where import_file.user_id = session.user_id
              and import_file.raw_csv_hash = session.raw_csv_hash
          )
      `;
      counts.push({ table: "fkh_import_files", column: "backfill", count: missingImportFiles.count });

      return counts;
    }

    await tx`
      insert into fkh_users (id, email, name, updated_at)
      values (${targetUserId}, ${targetEmail}, ${targetName}, now())
      on conflict (id) do update set
        email = coalesce(excluded.email, fkh_users.email),
        name = coalesce(excluded.name, fkh_users.name),
        updated_at = now()
    `;

    for (const [table, column] of userOwnedColumns) {
      const result = await tx`
        update ${tx(table)}
        set ${tx(column)} = ${targetUserId}
        where ${tx(column)} = ${legacyUserId}
      `;
      counts.push({ table, column, count: result.count });
    }

    const backfilledImportFiles = await tx`
      insert into fkh_import_files (
        user_id,
        session_id,
        source,
        file_name,
        file_size_bytes,
        raw_csv_hash,
        parse_version,
        status,
        metadata_json,
        created_at,
        updated_at
      )
      select
        session.user_id,
        session.id,
        session.source,
        coalesce(session.file_name, session.raw_upload_id, concat(session.source, '-', session.id::text, '.csv')),
        session.file_size_bytes,
        session.raw_csv_hash,
        'rapsodo-v1',
        'saved',
        jsonb_build_object('backfilledFromSessionId', session.id),
        session.created_at,
        now()
      from fkh_sessions session
      where session.user_id = ${targetUserId}
        and session.raw_csv_hash is not null
      on conflict (user_id, raw_csv_hash) do nothing
    `;
    counts.push({ table: "fkh_import_files", column: "backfill", count: backfilledImportFiles.count });

    return counts;
  });

  const rowsWithData = changes.filter((change) => change.count > 0);
  const action = dryRun ? "would update" : "updated";

  if (rowsWithData.length === 0) {
    console.log(`No legacy rows found for ${legacyUserId}.`);
  } else {
    for (const change of rowsWithData) {
      console.log(`${action} ${change.count} row(s) in ${change.table}.${change.column}`);
    }
  }
} finally {
  await sql.end();
}
