import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import postgres, { type Sql } from "postgres";

import { authStorageState, expectPageReady } from "./helpers";
import { createScorecardProofToken } from "../../src/lib/scorecard-proof-token-core";

type CompetitionFixture = {
  token: string;
  courseId: string;
  teeSetId: string;
  categoryId: string;
  recordId: string;
  tournamentId: string;
  sessionId: string;
  courseName: string;
  tournamentTitle: string;
};

const databaseUrl = process.env.DATABASE_URL ?? loadEnvFile().DATABASE_URL;
const authUserId = authStorageState ? extractSupabaseUserId(authStorageState) : null;
const canRunCompetitions = Boolean(
  databaseUrl && authStorageState && existsSync(authStorageState) && authUserId,
);

test.describe("course records and major-style tournaments", () => {
  test.skip(
    !canRunCompetitions,
    "Set DATABASE_URL and PLAYWRIGHT_AUTH_STATE with a Supabase session to run live course record checks.",
  );
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(150_000);

  let sql: Sql | null = null;
  let fixture: CompetitionFixture | null = null;

  test.beforeAll(async () => {
    if (!databaseUrl || !authUserId) {
      return;
    }

    sql = postgres(databaseUrl, { max: 1, prepare: false });
    fixture = await seedCompetitionFixture(sql, authUserId);
  });

  test.afterAll(async () => {
    if (sql && fixture && authUserId) {
      await cleanupCompetitionFixture(sql, fixture, authUserId);
    }
    await sql?.end();
  });

  test("submits a verified course record, enters a major and sends mismatches to review", async ({
    page,
  }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/courses/${data.courseId}/records`);
    await expectPageReady(page, new RegExp(data.courseName));
    await expect(page.locator("body")).toContainText(/Course Champion|Current champion/i);

    await page.goto(`/course-records/${data.recordId}`);
    await expectPageReady(page, /Best gross score/i);
    await page.getByRole("button", { name: /Submit/i }).click();
    const recordForm = page.locator("[data-course-record-attempt-form]").filter({ visible: true });
    await recordForm.locator('select[name="sessionId"]').selectOption(data.sessionId);
    await recordForm
      .locator('input[name="screenshotPath"]')
      .evaluate((input: HTMLInputElement, value) => {
        input.value = value;
      }, `/uploads/scorecards/${data.token}.png`);
    await recordForm.locator('input[name="extractedScorecardTotal"]').fill("72");
    await recordForm.locator('input[name="scorecardProofToken"]').evaluate(
      (input: HTMLInputElement, token) => {
        input.value = token;
      },
      createScorecardProofToken({
        userId: authUserId!,
        scopeType: "course_record",
        scopeId: data.recordId,
        roundNumber: null,
        imageHash: "a".repeat(64),
        totalScore: 72,
        courseName: data.courseName,
        teeName: "White",
        dateIso: "2026-05-15",
      }),
    );
    await submitServerActionForm(
      page,
      recordForm,
      new RegExp(`/course-records/${data.recordId}\\?attempt=`),
    );

    await expect
      .poll(async () => {
        const rows = await sql!`
          select rank, score_label
          from fkh_course_record_results
          where record_id = ${data.recordId}
            and user_id = ${authUserId}
        `;
        return rows[0]?.rank ?? null;
      })
      .toBe(1);

    await page.goto(`/courses/${data.courseId}/records`);
    await expect(page.locator("body")).toContainText(/Current Champion|Course Champion/i);
    await expect(
      page.getByRole("link", { name: /Best gross score.*You 72/i }).first(),
    ).toBeVisible();

    await page.goto(`/tournaments/${data.tournamentId}`);
    await expectPageReady(page, new RegExp(data.tournamentTitle));
    await page.getByRole("button", { name: /^Enter$/i }).click();
    await page.getByLabel(/I accept/i).check();
    const entryForm = page
      .getByRole("button", { name: /Accept & enter tournament/i })
      .locator("xpath=ancestor::form");
    await submitServerActionForm(
      page,
      entryForm,
      new RegExp(`/tournaments/${data.tournamentId}\\?joined=1`),
    );
    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_tournament_entries
          where tournament_id = ${data.tournamentId}
            and user_id = ${authUserId}
            and status = 'entered'
        `;
        return rows.length;
      })
      .toBe(1);

    await page.goto(`/tournaments/${data.tournamentId}`);
    await submitImportedTournamentRound(page, data.sessionId);
    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_tournament_submissions
          where tournament_id = ${data.tournamentId}
            and user_id = ${authUserId}
            and round_number = 1
        `;
        return rows.length;
      })
      .toBe(1);

    await page.goto(`/tournaments/${data.tournamentId}`);
    await submitManualTournamentRound({
      page,
      tournamentId: data.tournamentId,
      userId: authUserId!,
      round: "2",
      gross: "74",
      extracted: "73",
      proofId: `major-r2-${data.token}`,
    });
    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_moderation_events
          where actor_user_id = ${authUserId}
            and event_type = 'tournament_score_mismatch'
            and metadata_json->>'tournament' = ${data.tournamentTitle}
        `;
        return rows.length;
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_feed_items
          where user_id = ${authUserId}
            and headline like ${`%${data.token}%`}
        `;
        return rows.length;
      })
      .toBeGreaterThanOrEqual(2);
  });
});

async function submitImportedTournamentRound(
  page: import("@playwright/test").Page,
  sessionId: string,
) {
  let form = page
    .locator("form[data-tournament-submit-form]")
    .filter({ has: page.locator(`input[name="sessionId"][value="${sessionId}"]`), visible: true })
    .first();

  if ((await form.count()) === 0) {
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    form = page
      .locator("form[data-tournament-submit-form]")
      .filter({
        has: page.locator(`input[name="sessionId"][value="${sessionId}"]`),
        visible: true,
      })
      .first();
  }

  await expect(form).toBeVisible();
  await submitServerActionForm(page, form, /\/tournaments\/.+\?submission=/);
}

async function submitManualTournamentRound({
  page,
  tournamentId,
  userId,
  round,
  gross,
  extracted,
  proofId,
}: {
  page: import("@playwright/test").Page;
  tournamentId: string;
  userId: string;
  round: string;
  gross: string;
  extracted: string;
  proofId: string;
}) {
  let form = page
    .locator("[data-tournament-submit-form]")
    .filter({ has: page.locator('input[name="grossScore"]:not([type="hidden"])'), visible: true })
    .first();
  if ((await form.count()) === 0) {
    await page.getByRole("button", { name: /^Submit/i }).click();
    form = page
      .locator("[data-tournament-submit-form]")
      .filter({ has: page.locator('input[name="grossScore"]:not([type="hidden"])'), visible: true })
      .first();
  }
  await expect(form).toBeVisible();
  await form.locator('input[name="roundNumber"]:not([type="hidden"])').fill(round);
  await form.locator('input[name="grossScore"]:not([type="hidden"])').fill(gross);
  await form.locator('input[name="netScore"]:not([type="hidden"])').fill(gross);
  await form
    .locator('input[name="scorecardScreenshotPath"]')
    .evaluate((input: HTMLInputElement, value) => {
      input.value = value;
    }, `/uploads/scorecards/${proofId}.png`);
  await form.locator('input[name="extractedScorecardTotal"]').fill(extracted);
  await form.locator('input[name="scorecardProofToken"]').evaluate(
    (input: HTMLInputElement, token) => {
      input.value = token;
    },
    createScorecardProofToken({
      userId,
      scopeType: "tournament",
      scopeId: tournamentId,
      roundNumber: Number(round),
      imageHash: "b".repeat(64),
      totalScore: Number(extracted),
      courseName: null,
      teeName: null,
      dateIso: null,
    }),
  );
  await submitServerActionForm(page, form, /\/tournaments\/.+\?submission=/);
}

async function submitServerActionForm(
  page: import("@playwright/test").Page,
  form: import("@playwright/test").Locator,
  expectedRedirect: RegExp,
) {
  const actionPath = new URL(page.url()).pathname;
  const responsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && new URL(response.url()).pathname === actionPath;
  });

  await form.evaluate((node: HTMLFormElement) => node.requestSubmit());
  const response = await responsePromise;

  // Next Server Actions return their client navigation target in this response header.
  // Assert that contract directly: Playwright does not consistently emit a full load event
  // for the ensuing client transition in a production build.
  expect(response.status()).toBe(303);
  expect(response.headers()["x-action-redirect"]).toMatch(expectedRedirect);
}

async function seedCompetitionFixture(sql: Sql, authUserId: string): Promise<CompetitionFixture> {
  const token = randomUUID().slice(0, 8);
  const courseId = randomUUID();
  const teeSetId = randomUUID();
  const categoryId = randomUUID();
  const recordId = randomUUID();
  const tournamentId = randomUUID();
  const sessionId = randomUUID();
  const courseName = `Playwright Links ${token}`;
  const tournamentTitle = `Playwright Spring Major ${token}`;
  const now = new Date();

  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values (${authUserId}, null, 'Playwright competition user', ${now})
    on conflict (id) do update set updated_at = excluded.updated_at
  `;
  await sql`
    insert into fkh_user_profiles (user_id, username, display_name, public_profile, friend_profile, feed_visibility_default, leaderboard_visibility, updated_at)
    values (${authUserId}, ${`competition-${token}`}, 'Playwright competition user', true, true, 'friends', 'friends', ${now})
    on conflict (user_id) do update set
      public_profile = true,
      friend_profile = true,
      feed_visibility_default = 'friends',
      leaderboard_visibility = 'friends',
      updated_at = excluded.updated_at
  `;
  await sql`
    insert into fkh_courses (id, name, country, provider, external_id, visibility, created_by_user_id, updated_at)
    values (${courseId}, ${courseName}, 'GB', 'playwright', ${token}, 'shared', ${authUserId}, ${now})
  `;
  await sql`
    insert into fkh_tee_sets (id, course_id, name, par, course_rating, slope_rating, yards, updated_at)
    values (${teeSetId}, ${courseId}, 'White', 72, 72.1, 128, 6800, ${now})
  `;
  await sql`
    insert into fkh_sessions (
      id, user_id, source, type, date, course_id, tee_set_id, course_name, round_status,
      scorecard_json, raw_upload_id, file_name, file_size_bytes, raw_csv_hash, raw_csv_text
    )
    values (
      ${sessionId},
      ${authUserId},
      'rapsodo',
      'simulated_course',
      ${now},
      ${courseId},
      ${teeSetId},
      ${courseName},
      'complete',
      ${JSON.stringify(playwrightScorecard())}::jsonb,
      ${`playwright-${token}`},
      ${`playwright-round-${token}.csv`},
      120,
      ${`${token}${token}${token}${token}${token}${token}${token}${token}`.slice(0, 64)},
      'shot,csv'
    )
  `;
  await sql`
    insert into fkh_course_record_categories (
      id, slug, name, description, record_type, metric_kind, scoring_direction, verification_required, sort_order, metadata_json, updated_at
    )
    values (
      ${categoryId},
      ${`playwright-best-gross-${token}`},
      'Best gross score',
      'Lowest verified gross score for this course and tee.',
      'best_gross_score',
      'strokes',
      'asc',
      'silver',
      10,
      '{"unit":"strokes"}'::jsonb,
      ${now}
    )
  `;
  await sql`
    insert into fkh_course_records (
      id, category_id, course_id, tee_set_id, created_by_user_id, record_type, scope, period, verification_required, status, updated_at
    )
    values (${recordId}, ${categoryId}, ${courseId}, ${teeSetId}, ${authUserId}, 'best_gross_score', 'public', 'all_time', 'silver', 'active', ${now})
  `;
  await sql`
    insert into fkh_tournaments (
      id, title, description, course_id, tee_set_id, format, visibility, status, starts_at, ends_at,
      round_count, verification_policy, screenshot_required, direct_rapsodo_required, cut_rule_json, playoff_rule_json,
      created_by_user_id, metadata_json, updated_at
    )
    values (
      ${tournamentId},
      ${tournamentTitle},
      'Four-round Playwright major',
      ${courseId},
      ${teeSetId},
      'four_round_major',
      'public',
      'open',
      ${now},
      ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)},
      4,
      'gold',
      true,
      true,
      '{"enabled":true,"afterRound":2,"topAndTies":50}'::jsonb,
      '{"type":"sudden_death","holes":[18,10]}'::jsonb,
      ${authUserId},
      '{"template":"spring_major_week"}'::jsonb,
      ${now}
    )
  `;
  await sql`
    insert into fkh_tournament_rounds (tournament_id, round_number, title, starts_at, ends_at, status, updated_at)
    values
      (${tournamentId}, 1, 'Round 1', ${now}, ${new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)}, 'open', ${now}),
      (${tournamentId}, 2, 'Round 2', ${now}, ${new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)}, 'open', ${now}),
      (${tournamentId}, 3, 'Round 3', ${now}, ${new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000)}, 'scheduled', ${now}),
      (${tournamentId}, 4, 'Round 4', ${now}, ${new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)}, 'scheduled', ${now})
  `;

  return {
    token,
    courseId,
    teeSetId,
    categoryId,
    recordId,
    tournamentId,
    sessionId,
    courseName,
    tournamentTitle,
  };
}

async function cleanupCompetitionFixture(
  sql: Sql,
  fixture: CompetitionFixture,
  authUserId: string,
) {
  await sql`delete from fkh_moderation_events where actor_user_id = ${authUserId} and metadata_json::text like ${`%${fixture.token}%`}`;
  await sql`delete from fkh_feed_items where user_id = ${authUserId} and headline like ${`%${fixture.token}%`}`;
  await sql`delete from fkh_tournaments where id = ${fixture.tournamentId}`;
  await sql`delete from fkh_sessions where id = ${fixture.sessionId}`;
  await sql`delete from fkh_courses where id = ${fixture.courseId}`;
  await sql`delete from fkh_course_record_categories where id = ${fixture.categoryId}`;
}

function playwrightScorecard() {
  return Array.from({ length: 18 }, (_, index) => ({
    holeNumber: index + 1,
    par: 4,
    yards: 370,
    name: null,
    score: 4,
    netScore: 4,
    putts: 2,
    fairwayHit: true,
    gir: true,
    strokeIndex: index + 1,
  }));
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
