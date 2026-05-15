import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import postgres, { type Sql } from "postgres";

import { authStorageState, expectPageReady } from "./helpers";

type GroupFixture = {
  token: string;
  ownerUserId: string;
  groupId: string;
  slug: string;
  inviteCode: string;
  name: string;
};

const databaseUrl = process.env.DATABASE_URL ?? loadEnvFile().DATABASE_URL;
const authUserId = authStorageState ? extractSupabaseUserId(authStorageState) : null;
const canRunGroups = Boolean(databaseUrl && authStorageState && existsSync(authStorageState) && authUserId);

test.describe("group invite flow", () => {
  test.skip(
    !canRunGroups,
    "Set DATABASE_URL and PLAYWRIGHT_AUTH_STATE with a Supabase session to run live group checks.",
  );
  test.use(authStorageState ? { storageState: authStorageState } : {});

  let sql: Sql | null = null;
  let fixture: GroupFixture | null = null;

  test.beforeAll(async () => {
    if (!databaseUrl || !authUserId) {
      return;
    }

    sql = postgres(databaseUrl, { max: 1, prepare: false });
    fixture = await seedGroupFixture(sql, authUserId);
  });

  test.afterAll(async () => {
    if (sql && fixture) {
      await cleanupGroupFixture(sql, fixture);
    }
    await sql?.end();
  });

  test("joins a private group from an invite code", async ({ page }) => {
    expect(fixture).not.toBeNull();
    const data = fixture!;

    await page.goto(`/groups?invite=${data.inviteCode}`);
    await expectPageReady(page, /Groups/i);
    await expect(page.locator("body")).toContainText(data.name);
    await page.getByRole("button", { name: /Join from invite/i }).click();

    await expect
      .poll(async () => {
        const rows = await sql!`
          select id
          from fkh_group_memberships
          where group_id = ${data.groupId}
            and user_id = ${authUserId}
            and status = 'active'
        `;
        return rows.length;
      })
      .toBe(1);

    await page.goto(`/groups/${data.slug}`);
    await expectPageReady(page, new RegExp(data.name));
    await expect(page.locator("body")).toContainText("Invite");
    await expect(page.locator(`img[src="/groups/qr/${data.inviteCode}"]`)).toBeVisible();
  });
});

async function seedGroupFixture(sql: Sql, authUserId: string): Promise<GroupFixture> {
  const token = randomUUID().slice(0, 8);
  const ownerUserId = randomUUID();
  const groupId = randomUUID();
  const slug = `private-rapsodo-${token}`;
  const inviteCode = `invite-${token}`;
  const name = `Private Rapsodo League ${token}`;
  const now = new Date();

  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values (${authUserId}, null, 'Playwright group user', ${now})
    on conflict (id) do nothing
  `;
  await sql`
    insert into fkh_users (id, email, name, updated_at)
    values (${ownerUserId}, ${`group-owner-${token}@example.test`}, ${`Group owner ${token}`}, ${now})
  `;
  await sql`
    insert into fkh_user_profiles (user_id, username, display_name, public_profile, friend_profile, updated_at)
    values (${ownerUserId}, ${`group-owner-${token}`}, ${`Group owner ${token}`}, true, true, ${now})
  `;
  await sql`
    insert into fkh_groups (
      id, owner_user_id, slug, name, description, group_type, visibility, invite_code, rules, updated_at
    )
    values (
      ${groupId},
      ${ownerUserId},
      ${slug},
      ${name},
      'Invite-only Playwright group',
      'rapsodo_league',
      'private',
      ${inviteCode},
      'Verified imports preferred.',
      ${now}
    )
  `;
  await sql`
    insert into fkh_group_memberships (group_id, user_id, role, status, updated_at)
    values (${groupId}, ${ownerUserId}, 'owner', 'active', ${now})
  `;

  return { token, ownerUserId, groupId, slug, inviteCode, name };
}

async function cleanupGroupFixture(sql: Sql, fixture: GroupFixture) {
  await sql`delete from fkh_groups where id = ${fixture.groupId}`;
  await sql`delete from fkh_user_profiles where user_id = ${fixture.ownerUserId}`;
  await sql`delete from fkh_users where id = ${fixture.ownerUserId}`;
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
