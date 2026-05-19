import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import postgres, { type Sql } from "postgres";

import { authStorageState, expectPageReady } from "./helpers";

type IsolationFixture = {
  otherUserId: string;
  otherClubId: string;
  otherSessionId: string;
  ownSessionId: string;
  otherShotId: string;
  crossOwnedShotId: string;
  otherClubBrand: string;
  otherCourseName: string;
  ownCourseName: string;
};

const databaseUrl = process.env.DATABASE_URL ?? loadEnvFile().DATABASE_URL;
const authUserId = authStorageState ? extractSupabaseUserId(authStorageState) : null;
const canRunIsolation = Boolean(
  databaseUrl && authStorageState && existsSync(authStorageState) && authUserId,
);

test.describe("cross-user isolation", () => {
  test.skip(
    !canRunIsolation,
    "Set DATABASE_URL and PLAYWRIGHT_AUTH_STATE with a Supabase session to run live cross-user isolation checks.",
  );
  test.use(authStorageState ? { storageState: authStorageState } : {});

  let sql: Sql | null = null;
  let fixture: IsolationFixture | null = null;

  test.beforeAll(async () => {
    if (!databaseUrl || !authUserId) {
      return;
    }

    sql = postgres(databaseUrl, { max: 1, prepare: false });
    fixture = await seedIsolationFixture(sql, authUserId);
  });

  test.afterAll(async () => {
    if (sql && fixture) {
      await cleanupIsolationFixture(sql, fixture);
    }
    await sql?.end();
  });

  test("hides another user's bag, rounds, handicap rows, and shot counts", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;

    await page.goto("/bag");
    await expectPageReady(page, /Stock yardages/i);
    await expect(page.locator("body")).not.toContainText(data.otherClubBrand);

    await page.goto("/rounds");
    await expectPageReady(page, /Saved rounds/i);
    await expect(page.locator("body")).not.toContainText(data.otherCourseName);
    const ownRound = page.getByRole("row").filter({ hasText: data.ownCourseName }).first();
    await expect(ownRound).toBeVisible();
    await expect(ownRound).toContainText("0 shots");

    await page.goto("/handicap");
    await expectPageReady(page, /Handicap/i);
    await expect(page.locator("body")).not.toContainText(data.otherCourseName);
    const ownHandicapRound = page.getByRole("row").filter({ hasText: data.ownCourseName }).first();
    await expect(ownHandicapRound).toBeVisible();
    await expect(ownHandicapRound.locator("td").last()).toHaveText("0");
  });
});

async function seedIsolationFixture(sql: Sql, authUserId: string): Promise<IsolationFixture> {
  const token = randomUUID().slice(0, 8);
  const otherUserId = randomUUID();
  const otherClubId = randomUUID();
  const otherSessionId = randomUUID();
  const ownSessionId = randomUUID();
  const otherShotId = randomUUID();
  const crossOwnedShotId = randomUUID();
  const otherClubBrand = `ZXIsolation-${token}`;
  const otherCourseName = `Other user isolation ${token}`;
  const ownCourseName = `Current user isolation ${token}`;
  const now = new Date();
  const scorecard = [
    {
      holeNumber: 1,
      par: 4,
      yards: 400,
      name: "Isolation",
      score: 4,
      putts: 2,
    },
  ];

  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values (${authUserId}, null, 'Playwright isolation user', ${now})
    on conflict (id) do nothing
  `;
  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values (${otherUserId}, ${`isolation-${token}@example.test`}, 'Other isolation user', ${now})
  `;
  await sql`
    insert into fkh_clubs (id, user_id, type, brand, model, normalized_club_key, active, updated_at)
    values (${otherClubId}, ${otherUserId}, 'Driver', ${otherClubBrand}, 'Hidden Driver', ${`driver-${token}`}, true, ${now})
  `;
  await sql`
    insert into fkh_sessions (
      id, user_id, source, type, date, course_name, round_status, scorecard_json, raw_csv_text
    )
    values (
      ${otherSessionId}, ${otherUserId}, 'isolation-test', 'round', ${now}, ${otherCourseName}, 'complete',
      ${sql.json(scorecard)}, 'other isolation fixture'
    )
  `;
  await sql`
    insert into fkh_sessions (
      id, user_id, source, type, date, course_name, round_status, scorecard_json, raw_csv_text
    )
    values (
      ${ownSessionId}, ${authUserId}, 'isolation-test', 'round', ${now}, ${ownCourseName}, 'complete',
      ${sql.json(scorecard)}, 'current isolation fixture'
    )
  `;
  await sql`
    insert into fkh_shots (
      id, user_id, session_id, club_id, shot_at, club_type, shot_number, carry_yd, total_yd, source_raw_json
    )
    values (
      ${otherShotId}, ${otherUserId}, ${otherSessionId}, ${otherClubId}, ${now}, 'Driver', 1, 250, 270,
      ${sql.json({ fixture: "other-user" })}
    )
  `;
  await sql`
    insert into fkh_shots (
      id, user_id, session_id, club_id, shot_at, club_type, shot_number, carry_yd, total_yd, source_raw_json
    )
    values (
      ${crossOwnedShotId}, ${otherUserId}, ${ownSessionId}, ${otherClubId}, ${now}, 'Driver', 2, 251, 271,
      ${sql.json({ fixture: "cross-owned-shot-count" })}
    )
  `;

  return {
    otherUserId,
    otherClubId,
    otherSessionId,
    ownSessionId,
    otherShotId,
    crossOwnedShotId,
    otherClubBrand,
    otherCourseName,
    ownCourseName,
  };
}

async function cleanupIsolationFixture(sql: Sql, fixture: IsolationFixture) {
  await sql`
    delete from fkh_shots
    where id in (${fixture.otherShotId}, ${fixture.crossOwnedShotId})
  `;
  await sql`
    delete from fkh_sessions
    where id in (${fixture.otherSessionId}, ${fixture.ownSessionId})
  `;
  await sql`
    delete from fkh_clubs
    where id = ${fixture.otherClubId}
  `;
  await sql`
    delete from fkh_users
    where id = ${fixture.otherUserId}
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
  const cookie = state.cookies?.find(
    (item) => item.name.startsWith("sb-") && item.name.endsWith("-auth-token"),
  );
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
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
    };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
