import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import postgres, { type Sql } from "postgres";

import { authStorageState, expectPageReady } from "./helpers";

type SocialFixture = {
  token: string;
  targetUserId: string;
  incomingUserId: string;
  friendUserId: string;
  strangerUserId: string;
  privateUserId: string;
  targetUsername: string;
  privateUsername: string;
  targetDisplayName: string;
  incomingDisplayName: string;
  friendHeadline: string;
  strangerHeadline: string;
  publicHeadline: string;
  friendFeedItemId: string;
  strangerFeedItemId: string;
  publicFeedItemId: string;
  incomingRequestId: string;
};

const databaseUrl = process.env.DATABASE_URL ?? loadEnvFile().DATABASE_URL;
const authUserId = authStorageState ? extractSupabaseUserId(authStorageState) : null;
const canRunSocial = Boolean(
  databaseUrl && authStorageState && existsSync(authStorageState) && authUserId,
);

test.describe("social friends and feed visibility", () => {
  test.skip(
    !canRunSocial,
    "Set DATABASE_URL and PLAYWRIGHT_AUTH_STATE with a Supabase session to run live social checks.",
  );
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(180_000);

  let sql: Sql | null = null;
  let fixture: SocialFixture | null = null;

  test.beforeAll(async () => {
    if (!databaseUrl || !authUserId) {
      return;
    }

    sql = postgres(databaseUrl, { max: 1, prepare: false });
    fixture = await seedSocialFixture(sql, authUserId);
  });

  test.afterAll(async () => {
    if (sql && fixture) {
      await cleanupSocialFixture(sql, fixture, authUserId!);
    }
    await sql?.end();
  });

  test("sends and accepts friend requests without account memberships", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;

    await gotoSocialPage(page, `/friends?q=${data.targetUsername}`, /Friends/i);
    await expect(page.locator("body")).toContainText(data.targetDisplayName);
    await page.getByRole("button", { name: /^Add$/ }).first().click();

    await expect
      .poll(async () => {
        const sentRows = await sql!`
          select id
          from fkh_friend_requests
          where requester_user_id = ${authUserId}
            and recipient_user_id = ${data.targetUserId}
            and status = 'pending'
        `;
        return sentRows.length;
      })
      .toBe(1);

    await gotoSocialPage(page, "/friends", /Incoming requests/i);
    await expect(page.locator("body")).toContainText(data.incomingDisplayName);
    await page
      .getByRole("button", { name: /Accept/i })
      .first()
      .click();

    const [userAId, userBId] = sortedUserPair(authUserId!, data.incomingUserId);
    await expect
      .poll(async () => {
        const friendshipRows = await sql!`
          select id
          from fkh_friendships
          where user_a_id = ${userAId}
            and user_b_id = ${userBId}
        `;
        return friendshipRows.length;
      })
      .toBe(1);
  });

  test("shows friend feed cards and hides non-friend friend-only cards", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;

    await gotoSocialPage(page, "/feed", /Social feed/i);
    await expect(page.locator("body")).toContainText(data.friendHeadline);
    await expect(page.locator("body")).toContainText(data.publicHeadline);
    await expect(page.locator("body")).not.toContainText(data.strangerHeadline);
  });

  test("keeps private profiles closed to strangers", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;

    const response = await page.goto(`/profile/${data.privateUsername}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    expect(response?.status()).toBe(404);
  });

  test("supports feed kudos, comments and reporting", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;
    const comment = `Nice work ${data.token}`;

    await gotoSocialPage(page, "/feed", /Social feed/i);
    await expect(page.locator("body")).toContainText(data.friendHeadline);
    const card = await revealFeedCard(page, data.friendFeedItemId);
    await card.getByRole("button", { name: /Kudos/i }).first().click();

    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_feed_reactions
          where feed_item_id = ${data.friendFeedItemId}
            and user_id = ${authUserId}
            and reaction_type = 'kudos'
        `;
        return rows.length;
      })
      .toBe(1);

    await gotoSocialPage(page, "/feed", data.friendHeadline);
    const refreshedCard = await revealFeedCard(page, data.friendFeedItemId);
    await refreshedCard.getByPlaceholder(/Write a comment/i).fill(comment);
    await refreshedCard.getByRole("button", { name: /^Post$/ }).click();

    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_feed_comments
          where feed_item_id = ${data.friendFeedItemId}
            and user_id = ${authUserId}
            and body = ${comment}
            and deleted_at is null
        `;
        return rows.length;
      })
      .toBe(1);

    await gotoSocialPage(page, "/feed", data.friendHeadline);
    const reportedCard = await revealFeedCard(page, data.friendFeedItemId);
    await reportedCard.getByText("Controls").first().click();
    const reportForm = reportedCard.locator("[data-feed-report-form]");
    await expect(reportForm).toBeVisible();
    await Promise.all([
      page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/feed"),
      ),
      reportForm.evaluate((form: HTMLFormElement) => form.requestSubmit()),
    ]);

    await expect
      .poll(
        async () => {
          const rows = await sql!`
          select id
          from fkh_social_reports
          where reporter_user_id = ${authUserId}
            and target_type = 'feed_item'
            and target_id = ${data.friendFeedItemId}
        `;
          return rows.length;
        },
        { timeout: 60_000 },
      )
      .toBe(1);
  });

  test("blocking removes friend-scoped feed access", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;

    await gotoSocialPage(page, "/friends", /Friends/i);
    const row = page.locator(`[data-friend-user-id="${data.friendUserId}"]`).first();
    const blockForm = row.locator("[data-friend-block-form]");
    await expect(blockForm).toBeVisible();
    await Promise.all([
      page.waitForRequest(
        (request) => request.method() === "POST" && request.url().includes("/friends"),
      ),
      blockForm.evaluate((form: HTMLFormElement) => form.requestSubmit()),
    ]);

    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_user_blocks
          where blocker_user_id = ${authUserId}
            and blocked_user_id = ${data.friendUserId}
        `;
        return rows.length;
      })
      .toBe(1);

    await gotoSocialPage(page, "/feed", /Social feed/i);
    await expect(page.locator("body")).not.toContainText(data.friendHeadline);
  });
});

async function gotoSocialPage(page: Page, routePath: string, expectedText: RegExp | string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
      await expectPageReady(page, expectedText);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(500);
    }
  }

  throw lastError;
}

async function revealFeedCard(page: Page, feedItemId: string) {
  const card = page.locator(`[data-feed-item-id="${feedItemId}"]`);

  if (await card.isVisible()) {
    return card;
  }

  const summaries = page.locator("summary").filter({ hasText: "Individual cards" });
  const count = await summaries.count();

  for (let index = 0; index < count; index += 1) {
    await summaries.nth(index).click();
    if (await card.isVisible()) {
      return card;
    }
  }

  await expect(card).toBeVisible();
  return card;
}

async function seedSocialFixture(sql: Sql, authUserId: string): Promise<SocialFixture> {
  const token = randomUUID().slice(0, 8);
  const targetUserId = randomUUID();
  const incomingUserId = randomUUID();
  const friendUserId = randomUUID();
  const strangerUserId = randomUUID();
  const privateUserId = randomUUID();
  const targetUsername = `social-target-${token}`;
  const privateUsername = `private-${token}`;
  const targetDisplayName = `Social target ${token}`;
  const incomingDisplayName = `Incoming friend ${token}`;
  const friendHeadline = `Friend PB visible ${token}`;
  const strangerHeadline = `Stranger PB hidden ${token}`;
  const publicHeadline = `Public PB visible ${token}`;
  const friendFeedItemId = randomUUID();
  const strangerFeedItemId = randomUUID();
  const publicFeedItemId = randomUUID();
  const incomingRequestId = randomUUID();
  const now = new Date();
  const [friendAId, friendBId] = sortedUserPair(authUserId, friendUserId);

  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values (${authUserId}, null, 'Playwright social user', ${now})
    on conflict (id) do nothing
  `;
  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values
      (${targetUserId}, ${`social-target-${token}@example.test`}, ${targetDisplayName}, ${now}),
      (${incomingUserId}, ${`social-incoming-${token}@example.test`}, ${incomingDisplayName}, ${now}),
      (${friendUserId}, ${`social-friend-${token}@example.test`}, ${`Feed friend ${token}`}, ${now}),
      (${strangerUserId}, ${`social-stranger-${token}@example.test`}, ${`Feed stranger ${token}`}, ${now}),
      (${privateUserId}, ${`social-private-${token}@example.test`}, ${`Private golfer ${token}`}, ${now})
  `;
  await sql`
    insert into fkh_user_profiles (
      user_id, username, display_name, public_profile, friend_profile, feed_visibility_default, leaderboard_visibility, updated_at
    )
    values
      (${targetUserId}, ${targetUsername}, ${targetDisplayName}, true, true, 'friends', 'friends', ${now}),
      (${incomingUserId}, ${`incoming-${token}`}, ${incomingDisplayName}, true, true, 'friends', 'friends', ${now}),
      (${friendUserId}, ${`feed-friend-${token}`}, ${`Feed friend ${token}`}, true, true, 'friends', 'friends', ${now}),
      (${strangerUserId}, ${`feed-stranger-${token}`}, ${`Feed stranger ${token}`}, true, true, 'friends', 'friends', ${now}),
      (${privateUserId}, ${privateUsername}, ${`Private golfer ${token}`}, false, false, 'private', 'private', ${now})
  `;
  await sql`
    insert into fkh_friend_requests (id, requester_user_id, recipient_user_id, status, created_at, updated_at)
    values (${incomingRequestId}, ${incomingUserId}, ${authUserId}, 'pending', ${now}, ${now})
  `;
  await sql`
    insert into fkh_friendships (user_a_id, user_b_id, visibility_level, created_at)
    values (${friendAId}, ${friendBId}, 'friends', ${now})
    on conflict (user_a_id, user_b_id) do nothing
  `;
  await sql`
    insert into fkh_feed_items (
      id, user_id, item_type, headline, metric_label, metric_value, context, visibility, verification_label, dedupe_key, created_at, updated_at
    )
    values
      (${friendFeedItemId}, ${friendUserId}, 'new_pb', ${friendHeadline}, 'Total', '190.4 yd', 'Friend-only card', 'friends', 'Rapsodo CSV', ${`friend-${token}`}, ${now}, ${now}),
      (${strangerFeedItemId}, ${strangerUserId}, 'new_pb', ${strangerHeadline}, 'Total', '191.4 yd', 'Non-friend card', 'friends', 'Rapsodo CSV', ${`stranger-${token}`}, ${now}, ${now}),
      (${publicFeedItemId}, ${strangerUserId}, 'achievement_unlock', ${publicHeadline}, 'Achievement', '+250 XP', 'Public card', 'public', 'Rapsodo CSV', ${`public-${token}`}, ${now}, ${now})
  `;

  return {
    token,
    targetUserId,
    incomingUserId,
    friendUserId,
    strangerUserId,
    privateUserId,
    targetUsername,
    privateUsername,
    targetDisplayName,
    incomingDisplayName,
    friendHeadline,
    strangerHeadline,
    publicHeadline,
    friendFeedItemId,
    strangerFeedItemId,
    publicFeedItemId,
    incomingRequestId,
  };
}

async function cleanupSocialFixture(sql: Sql, fixture: SocialFixture, authUserId: string) {
  await sql`
    delete from fkh_feed_items
    where id in (${fixture.friendFeedItemId}, ${fixture.strangerFeedItemId}, ${fixture.publicFeedItemId})
  `;
  await sql`
    delete from fkh_social_reports
    where reporter_user_id = ${authUserId}
      and target_type = 'feed_item'
      and target_id in (${fixture.friendFeedItemId}, ${fixture.strangerFeedItemId}, ${fixture.publicFeedItemId})
  `;
  await sql`
    delete from fkh_moderation_events
    where actor_user_id = ${authUserId}
      and target_type = 'feed_item'
      and target_id in (${fixture.friendFeedItemId}, ${fixture.strangerFeedItemId}, ${fixture.publicFeedItemId})
  `;
  await sql`
    delete from fkh_user_blocks
    where blocker_user_id = ${authUserId}
       or blocked_user_id = ${authUserId}
  `;
  await sql`
    delete from fkh_friend_requests
    where id = ${fixture.incomingRequestId}
       or (requester_user_id = ${authUserId} and recipient_user_id = ${fixture.targetUserId})
  `;
  await sql`
    delete from fkh_friendships
    where user_a_id in (${authUserId}, ${fixture.incomingUserId}, ${fixture.friendUserId})
       or user_b_id in (${authUserId}, ${fixture.incomingUserId}, ${fixture.friendUserId})
  `;
  await sql`
    delete from fkh_user_profiles
    where user_id in (${fixture.targetUserId}, ${fixture.incomingUserId}, ${fixture.friendUserId}, ${fixture.strangerUserId}, ${fixture.privateUserId})
  `;
  await sql`
    delete from fkh_users
    where id in (${fixture.targetUserId}, ${fixture.incomingUserId}, ${fixture.friendUserId}, ${fixture.strangerUserId}, ${fixture.privateUserId})
  `;
}

function sortedUserPair(userAId: string, userBId: string) {
  return userAId < userBId ? ([userAId, userBId] as const) : ([userBId, userAId] as const);
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
