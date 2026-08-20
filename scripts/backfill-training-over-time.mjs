import "dotenv/config";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const dryRun = process.argv.includes("--dry-run");
const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function ensureTrainingSchema() {
  const [{ trainingTable }] = await sql`
    select to_regclass('public.fkh_golf_training_sessions') as "trainingTable"
  `;

  if (!trainingTable) {
    const migrationSql = await readFile(
      join(process.cwd(), "drizzle/0030_training_over_time.sql"),
      "utf8",
    );
    await sql.unsafe(migrationSql);
  }

  await sql`
    create unique index if not exists "fkh_golf_training_sessions_user_source_unique_idx"
    on "fkh_golf_training_sessions" ("user_id", "source_type", "source_id")
  `;
}

async function loadCounts() {
  const [row] = await sql`
    select
      (select count(*)::int from "fkh_sessions") as "sourceSessions",
      (select count(*)::int from "fkh_practice_sessions") as "practiceSessions",
      (select count(*)::int from "fkh_speed_training_sessions") as "speedSessions",
      (select count(*)::int from "fkh_golf_training_sessions") as "trainingSessions"
  `;
  const byType = await sql`
    select "source_type" as "sourceType", count(*)::int as count
    from "fkh_golf_training_sessions"
    group by "source_type"
    order by "source_type"
  `;

  return { ...row, byType };
}

async function previewBackfill() {
  const sourceRows = await sql.unsafe(previewSql(SOURCE_SESSION_CANDIDATES_SQL));
  const practiceRows = await sql.unsafe(previewSql(PRACTICE_SESSION_CANDIDATES_SQL));
  const speedRows = await sql.unsafe(previewSql(SPEED_SESSION_CANDIDATES_SQL));

  return mergeInsertedCounts([...sourceRows, ...practiceRows, ...speedRows]);
}

async function runBackfill() {
  const rows = await sql.begin(async (tx) => {
    const insertedSourceRows = await tx.unsafe(insertSql(SOURCE_SESSION_CANDIDATES_SQL));
    const insertedPracticeRows = await tx.unsafe(insertSql(PRACTICE_SESSION_CANDIDATES_SQL));
    const insertedSpeedRows = await tx.unsafe(insertSql(SPEED_SESSION_CANDIDATES_SQL));

    return [...insertedSourceRows, ...insertedPracticeRows, ...insertedSpeedRows];
  });

  return mergeInsertedCounts(rows);
}

function previewSql(candidateSql) {
  return `
    with candidate_rows as (${candidateSql})
    select "sourceType", count(*)::int as count
    from candidate_rows candidate
    where not exists (
      select 1
      from "fkh_golf_training_sessions" existing
      where existing."user_id" = candidate."userId"
        and existing."source_type" = candidate."sourceType"
        and existing."source_id" = candidate."sourceId"
    )
    group by "sourceType"
    order by "sourceType"
  `;
}

function insertSql(candidateSql) {
  return `
    insert into "fkh_golf_training_sessions" (
      "user_id",
      "source_type",
      "source_id",
      "title",
      "session_date",
      "duration_minutes",
      "holes_played",
      "total_swings",
      "full_swings",
      "short_game_swings",
      "putting_swings",
      "walked",
      "used_cart",
      "competition",
      "rpe",
      "mental_pressure",
      "physical_demand",
      "session_load",
      "notes",
      "updated_at"
    )
    ${candidateSql}
    on conflict ("user_id", "source_type", "source_id") do nothing
    returning "source_type" as "sourceType"
  `;
}

function mergeInsertedCounts(rows) {
  const counts = new Map();

  for (const row of rows) {
    const sourceType = row.sourceType ?? "unknown";
    counts.set(sourceType, (counts.get(sourceType) ?? 0) + Number(row.count ?? 1));
  }

  return [...counts.entries()]
    .map(([sourceType, count]) => ({ sourceType, count }))
    .sort((left, right) => left.sourceType.localeCompare(right.sourceType));
}

const LOAD_SELECT_SQL = `
  select
    "userId",
    "sourceType",
    "sourceId",
    "title",
    "sessionDate",
    "durationMinutes",
    "holesPlayed",
    "totalSwings",
    "fullSwings",
    "shortGameSwings",
    "puttingSwings",
    "walked",
    "usedCart",
    "competition",
    "rpe",
    "mentalPressure",
    "physicalDemand",
    round(
      (
        case
          when "fullSwings" is not null or "shortGameSwings" is not null or "puttingSwings" is not null then
            coalesce("fullSwings", 0) * 1.0
            + coalesce("shortGameSwings", 0) * 0.6
            + coalesce("puttingSwings", 0) * 0.3
          when "totalSwings" is not null then "totalSwings"
          when "durationMinutes" is not null then "durationMinutes"
          when "holesPlayed" is not null then
            case
              when "holesPlayed" >= 18 then 120
              when "holesPlayed" >= 9 then 60
              else greatest(30, round(("holesPlayed"::numeric / 9) * 60))
            end
          else 30
        end
      )
      * "rpe"
      * (
        1
        + case when "walked" then 0.15 else 0 end
        + case when "competition" then 0.10 else 0 end
        + case when coalesce("mentalPressure", 0) >= 8 then 0.05 else 0 end
      )
    )::numeric(10, 0) as "sessionLoad",
    "notes",
    now() as "updatedAt"
  from candidates
`;

const SOURCE_SESSION_CANDIDATES_SQL = `
  with shot_counts as (
    select "session_id", count(*)::int as "shot_count"
    from "fkh_shots"
    where
      coalesce("review_status", 'included') = 'restored'
      or (
        coalesce("review_status", 'included') = 'included'
        and lower(trim(coalesce("quality_tag", ''))) not like 'exclude%'
        and lower(trim(coalesce("quality_tag", ''))) not in (
          'exclude', 'excluded', 'delete', 'deleted', 'calibration',
          'warm-up', 'warmup', 'warm_up', 'bad-data', 'bad_data',
          'invalid', 'launch-monitor-error', 'misread', 'fat', 'mishit', 'thin', 'top'
        )
        and lower(trim(coalesce("shot_category", ''))) not in ('warm-up', 'warmup', 'warm_up')
      )
    group by "session_id"
  ),
  candidates as (
    select
      session_row."user_id" as "userId",
      case
        when session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round') then 'round'
        when lower(session_row."source") like '%rapsodo%'
          or lower(session_row."source") like '%trackman%'
          or lower(session_row."source") like '%square%' then 'launch_monitor'
        else 'imported'
      end as "sourceType",
      session_row."id"::text as "sourceId",
      case
        when session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round') then
          coalesce(nullif(trim(session_row."course_name"), ''), nullif(trim(session_row."location"), ''), 'Golf round')
        when lower(session_row."source") like '%rapsodo%' then 'Rapsodo practice'
        else coalesce(nullif(trim(session_row."file_name"), ''), 'Imported practice')
      end as "title",
      session_row."date"::date as "sessionDate",
      null::integer as "durationMinutes",
      case
        when session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round') then
          coalesce(jsonb_array_length(session_row."scorecard_json"), 18)
        else null
      end as "holesPlayed",
      case
        when session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round') then null
        else nullif(coalesce(shot_counts."shot_count", 0), 0)
      end as "totalSwings",
      null::integer as "fullSwings",
      null::integer as "shortGameSwings",
      null::integer as "puttingSwings",
      case
        when session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round') then false
        else null
      end as "walked",
      case
        when session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round') then true
        else null
      end as "usedCart",
      false as "competition",
      case
        when session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round') then 5
        when coalesce(shot_counts."shot_count", 0) >= 80 then 5
        else 4
      end as "rpe",
      null::integer as "mentalPressure",
      null::integer as "physicalDemand",
      'Backfilled from existing Fore King Hell activity data.'::text as "notes"
    from "fkh_sessions" session_row
    left join shot_counts on shot_counts."session_id" = session_row."id"
    where session_row."type" in ('round', 'simulator', 'simulated_course', 'real_round')
      or coalesce(shot_counts."shot_count", 0) > 0
  )
  ${LOAD_SELECT_SQL}
`;

const PRACTICE_SESSION_CANDIDATES_SQL = `
  with candidates as (
    select
      "user_id" as "userId",
      'practice' as "sourceType",
      "id"::text as "sourceId",
      "title",
      coalesce("completed_at", "planned_at", "created_at")::date as "sessionDate",
      null::integer as "durationMinutes",
      null::integer as "holesPlayed",
      nullif(greatest(coalesce("recorded_shots", 0), coalesce("target_shots", 0)), 0) as "totalSwings",
      null::integer as "fullSwings",
      null::integer as "shortGameSwings",
      null::integer as "puttingSwings",
      null::boolean as "walked",
      null::boolean as "usedCart",
      false as "competition",
      case when lower("focus_area") like '%putt%' or lower("focus_area") like '%short%' then 3 else 4 end as "rpe",
      null::integer as "mentalPressure",
      null::integer as "physicalDemand",
      'Backfilled from completed Fore King Hell practice data.'::text as "notes"
    from "fkh_practice_sessions"
    where "status" <> 'planned'
  )
  ${LOAD_SELECT_SQL}
`;

const SPEED_SESSION_CANDIDATES_SQL = `
  with candidates as (
    select
      "user_id" as "userId",
      case when "source" = 'manual' then 'manual' else 'launch_monitor' end as "sourceType",
      "id"::text as "sourceId",
      coalesce(nullif(trim("title"), ''), 'Speed training') as "title",
      "session_date"::date as "sessionDate",
      null::integer as "durationMinutes",
      null::integer as "holesPlayed",
      nullif("swing_count", 0) as "totalSwings",
      nullif("swing_count", 0) as "fullSwings",
      null::integer as "shortGameSwings",
      null::integer as "puttingSwings",
      null::boolean as "walked",
      null::boolean as "usedCart",
      false as "competition",
      case
        when "max_speed_mph" is not null and "avg_speed_mph" is not null and ("max_speed_mph" - "avg_speed_mph") > 8 then 9
        else 8
      end as "rpe",
      null::integer as "mentalPressure",
      8::integer as "physicalDemand",
      'Backfilled from Speed Centre.'::text as "notes"
    from "fkh_speed_training_sessions"
  )
  ${LOAD_SELECT_SQL}
`;

try {
  await ensureTrainingSchema();
  const before = await loadCounts();
  const inserted = dryRun ? await previewBackfill() : await runBackfill();
  const after = dryRun ? before : await loadCounts();

  console.log(JSON.stringify({ dryRun, before, inserted, after }, null, 2));
} finally {
  await sql.end();
}
