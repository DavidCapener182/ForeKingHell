import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import postgres, { type Sql } from "postgres";

import { authStorageState, expectPageReady } from "./helpers";

type ChallengeFixture = {
  token: string;
  templateId: string;
  challengeId: string;
  clubId: string;
  sessionId: string;
  shotId: string;
  creatorUserId: string;
  friendUserId: string;
  title: string;
};

const databaseUrl = process.env.DATABASE_URL ?? loadEnvFile().DATABASE_URL;
const authUserId = authStorageState ? extractSupabaseUserId(authStorageState) : null;
const canRunChallenges = Boolean(databaseUrl && authStorageState && existsSync(authStorageState) && authUserId);

test.describe("challenge competition flow", () => {
  test.skip(
    !canRunChallenges,
    "Set DATABASE_URL and PLAYWRIGHT_AUTH_STATE with a Supabase session to run live challenge checks.",
  );
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(120_000);

  let sql: Sql | null = null;
  let fixture: ChallengeFixture | null = null;

  test.beforeAll(async () => {
    if (!databaseUrl || !authUserId) {
      return;
    }

    sql = postgres(databaseUrl, { max: 1, prepare: false });
    fixture = await seedChallengeFixture(sql, authUserId);
  });

  test.afterAll(async () => {
    if (sql && fixture) {
      await cleanupChallengeFixture(sql, fixture, authUserId!);
    }
    await sql?.end();
  });

  test("joins a challenge, ranks from imported shots and comments", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;
    const comment = `Challenge comment ${data.token}`;

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/challenges");
    await expectPageReady(page, /Competition hub/i);
    await expect(page.locator("body")).toContainText(data.title);

    await page.goto(`/challenges/${data.challengeId}`);
    await expectPageReady(page, new RegExp(data.title));
    await page.getByRole("button", { name: /^Join$/ }).first().click();

    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_challenge_entries
          where challenge_id = ${data.challengeId}
            and user_id = ${authUserId}
            and status = 'joined'
        `;
        return rows.length;
      })
      .toBe(1);

    await page.goto(`/challenges/${data.challengeId}`);
    await expect(page.locator("[data-challenge-attempt-form]")).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Imported shot status");
    await expect(page.locator("body")).toContainText("Imported shots only");
    await expect(page.locator("body")).toContainText("286.4 yd");
    await page.getByPlaceholder("Add a comment").fill(comment);
    await page.getByRole("button", { name: /^Comment$/ }).click();

    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_challenge_comments
          where challenge_id = ${data.challengeId}
            and user_id = ${authUserId}
            and body = ${comment}
            and deleted_at is null
        `;
        return rows.length;
      })
      .toBe(1);
  });
});

async function seedChallengeFixture(sql: Sql, authUserId: string): Promise<ChallengeFixture> {
  const token = randomUUID().slice(0, 8);
  const templateId = randomUUID();
  const challengeId = randomUUID();
  const clubId = randomUUID();
  const sessionId = randomUUID();
  const shotId = randomUUID();
  const creatorUserId = randomUUID();
  const friendUserId = randomUUID();
  const title = `Playwright Longest Drive ${token}`;
  const now = new Date();
  const startsAt = new Date(now.getTime() - 60 * 60 * 1000);

  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values (${authUserId}, null, 'Playwright challenge user', ${now})
    on conflict (id) do nothing
  `;
  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values
      (${creatorUserId}, ${`challenge-creator-${token}@example.test`}, ${`Challenge creator ${token}`}, ${now}),
      (${friendUserId}, ${`challenge-friend-${token}@example.test`}, ${`Challenge friend ${token}`}, ${now})
  `;
  await sql`
    insert into fkh_user_profiles (user_id, username, display_name, public_profile, friend_profile, feed_visibility_default, leaderboard_visibility, updated_at)
    values
      (${creatorUserId}, ${`challenge-creator-${token}`}, ${`Challenge creator ${token}`}, true, true, 'public', 'public', ${now}),
      (${friendUserId}, ${`challenge-friend-${token}`}, ${`Challenge friend ${token}`}, true, true, 'friends', 'friends', ${now})
  `;
  await sql`
    insert into fkh_challenge_templates (id, slug, name, description, challenge_type, rules_json, scoring_direction, active, updated_at)
    values (
      ${templateId},
      ${`longest-drive-${token}`},
      'Longest Drive',
      'Post your best verified driver total distance.',
      'longest_drive',
      '{"metric":"total_yards","clubTypes":["driver"],"minShots":1}'::jsonb,
      'desc',
      true,
      ${now}
    )
  `;
  await sql`
    insert into fkh_challenges (id, template_id, creator_user_id, title, description, visibility, status, challenge_rules_json, starts_at, ends_at, updated_at)
    values (
      ${challengeId},
      ${templateId},
      ${creatorUserId},
      ${title},
      'Public Playwright challenge',
      'public',
      'open',
      '{"metric":"total_yards","clubTypes":["driver"],"minShots":1}'::jsonb,
      ${startsAt},
      ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)},
      ${now}
    )
  `;
  await sql`
    insert into fkh_clubs (id, user_id, type, brand, model, normalized_club_key, active, updated_at)
    values (${clubId}, ${authUserId}, 'driver', 'Playwright', 'Imported Driver', ${`playwright-driver-${token}`}, true, ${now})
  `;
  await sql`
    insert into fkh_sessions (
      id,
      user_id,
      source,
      type,
      date,
      raw_upload_id,
      file_name,
      raw_csv_hash,
      raw_csv_text
    )
    values (
      ${sessionId},
      ${authUserId},
      'rapsodo',
      'range',
      ${now},
      ${`playwright-challenge-${token}`},
      ${`playwright-challenge-${token}.csv`},
      ${`playwright-challenge-${token}`},
      'club,total,carry,side'
    )
  `;
  await sql`
    insert into fkh_shots (
      id,
      user_id,
      session_id,
      club_id,
      shot_at,
      club_type,
      shot_number,
      carry_yd,
      total_yd,
      side_carry_yd,
      shot_category,
      source_raw_json
    )
    values (
      ${shotId},
      ${authUserId},
      ${sessionId},
      ${clubId},
      ${now},
      'driver',
      1,
      271.2,
      286.4,
      3.4,
      'tee',
      '{"source":"playwright"}'::jsonb
    )
  `;

  return { token, templateId, challengeId, clubId, sessionId, shotId, creatorUserId, friendUserId, title };
}

async function cleanupChallengeFixture(sql: Sql, fixture: ChallengeFixture, authUserId: string) {
  await sql`delete from fkh_shots where id = ${fixture.shotId}`;
  await sql`delete from fkh_sessions where id = ${fixture.sessionId}`;
  await sql`delete from fkh_clubs where id = ${fixture.clubId}`;
  await sql`delete from fkh_challenges where id = ${fixture.challengeId}`;
  await sql`delete from fkh_challenge_templates where id = ${fixture.templateId}`;
  await sql`
    delete from fkh_feed_items
    where user_id = ${authUserId}
      and source_type in ('challenge', 'challenge_attempt', 'challenge_result')
      and headline like ${`%${fixture.title}%`}
  `;
  await sql`
    delete from fkh_user_profiles
    where user_id in (${fixture.creatorUserId}, ${fixture.friendUserId})
  `;
  await sql`
    delete from fkh_users
    where id in (${fixture.creatorUserId}, ${fixture.friendUserId})
  `;
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

        return [line.slice(0, index), unquote(line.slice(index + 1))];
      }),
  );
}

function extractSupabaseUserId(storageStatePath: string) {
  if (!existsSync(storageStatePath)) {
    return null;
  }

  const state = JSON.parse(readFileSync(storageStatePath, "utf8")) as {
    cookies?: Array<{ name: string; value: string }>;
  };
  const cookie = state.cookies?.find((item) => item.name.startsWith("sb-") && item.name.endsWith("-auth-token"));
  if (!cookie) {
    return null;
  }

  try {
    let value = decodeURIComponent(cookie.value);
    if (value.startsWith("base64-")) {
      value = Buffer.from(value.slice("base64-".length), "base64").toString("utf8");
    }
    const parsed = JSON.parse(value) as { access_token?: string } | [string];
    const token = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
    if (!token) {
      return null;
    }

    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
