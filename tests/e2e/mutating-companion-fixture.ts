import { existsSync, readFileSync } from "node:fs";
import postgres, { type TransactionSql } from "postgres";

import { authStorageState, hasLocalAuthBypass } from "./helpers";
import {
  extractSupabaseUserId,
  isDesignatedMutatingTestUser,
  LOCAL_AUTH_BYPASS_USER_ID,
} from "../support/mutating-e2e-account";

const databaseUrl = process.env.DATABASE_URL ?? loadEnvFile().DATABASE_URL;
const authenticatedUserId = hasLocalAuthBypass
  ? LOCAL_AUTH_BYPASS_USER_ID
  : extractSupabaseUserId(authStorageState);

export const canRunMutatingCompanionE2e = Boolean(
  databaseUrl &&
  isDesignatedMutatingTestUser(authenticatedUserId, process.env.PLAYWRIGHT_MUTATING_TEST_USER_ID),
);

export const mutatingCompanionSkipReason =
  "Mutating companion journeys require DATABASE_URL and PLAYWRIGHT_MUTATING_TEST_USER_ID matching the authenticated disposable test account.";

export class MutatingCompanionFixture {
  private readonly startedAt = new Date();
  private readonly fileNames = new Set<string>();
  private readonly practicePlanIds = new Set<string>();
  private readonly sessionIds = new Set<string>();

  trackFileName(fileName: string) {
    this.fileNames.add(fileName);
  }

  trackPracticePlan(practicePlanId: string | null) {
    if (practicePlanId) {
      this.practicePlanIds.add(practicePlanId);
    }
  }

  trackSession(sessionId: string | null) {
    if (sessionId) {
      this.sessionIds.add(sessionId);
    }
  }

  async cleanup() {
    if (!databaseUrl || !authenticatedUserId || !canRunMutatingCompanionE2e) {
      return;
    }

    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    try {
      await sql.begin(async (transaction) => {
        const sessionIds = new Set(this.sessionIds);
        for (const fileName of this.fileNames) {
          const rows = await transaction<{ id: string }[]>`
            select id
            from fkh_sessions
            where user_id = ${authenticatedUserId}
              and file_name = ${fileName}
          `;
          rows.forEach((row) => sessionIds.add(row.id));
        }

        for (const sessionId of sessionIds) {
          await cleanupSession(transaction, authenticatedUserId, sessionId, this.startedAt);
        }

        for (const practicePlanId of this.practicePlanIds) {
          await transaction`
            delete from fkh_practice_plans
            where id = ${practicePlanId}
              and user_id = ${authenticatedUserId}
          `;
        }

        await transaction`
          delete from fkh_achievement_progress
          where user_id = ${authenticatedUserId}
            and updated_at >= ${this.startedAt}
        `;
        await transaction`
          delete from fkh_achievement_sync_state
          where user_id = ${authenticatedUserId}
        `;
      });
    } finally {
      await sql.end();
    }
  }
}

async function cleanupSession(
  sql: TransactionSql,
  userId: string,
  sessionId: string,
  startedAt: Date,
) {
  const shotRows = await sql<{ id: string; club_id: string }[]>`
    select id, club_id
    from fkh_shots
    where user_id = ${userId}
      and session_id = ${sessionId}
  `;
  const shotIds = shotRows.map((row) => row.id);
  const clubIds = [...new Set(shotRows.map((row) => row.club_id))];

  await sql`
    delete from fkh_feed_items
    where user_id = ${userId}
      and (
        source_id = ${sessionId}
        or source_id like ${`${sessionId}:%`}
        or dedupe_key like ${`%:${sessionId}%`}
      )
  `;
  await sql`
    delete from fkh_xp_ledger
    where user_id = ${userId}
      and (
        session_id = ${sessionId}
        ${shotIds.length > 0 ? sql`or shot_id in ${sql(shotIds)}` : sql``}
      )
  `;
  await sql`
    delete from fkh_user_achievements
    where user_id = ${userId}
      and (
        source_session_id = ${sessionId}
        ${shotIds.length > 0 ? sql`or source_shot_id in ${sql(shotIds)}` : sql``}
      )
  `;
  await sql`
    delete from fkh_golf_training_sessions
    where user_id = ${userId}
      and source_id = ${sessionId}
  `;
  await sql`
    delete from fkh_import_files
    where user_id = ${userId}
      and session_id = ${sessionId}
  `;
  await sql`
    delete from fkh_sessions
    where id = ${sessionId}
      and user_id = ${userId}
  `;

  for (const clubId of clubIds) {
    await sql`
      delete from fkh_stock_yardages
      where user_id = ${userId}
        and club_id = ${clubId}
        and created_at >= ${startedAt}
    `;
    await sql`
      delete from fkh_clubs
      where id = ${clubId}
        and user_id = ${userId}
        and created_at >= ${startedAt}
        and not exists (
          select 1 from fkh_shots where club_id = ${clubId}
        )
    `;
  }
}

function loadEnvFile() {
  if (!existsSync(".env")) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index === -1) {
          return [line, ""];
        }
        const value = line.slice(index + 1);
        const unquoted =
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
            ? value.slice(1, -1)
            : value;
        return [line.slice(0, index), unquoted];
      }),
  );
}
