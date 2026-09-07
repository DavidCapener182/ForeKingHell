import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
test("Billing administration shows complete records and resolves the exact account without granting on review", async ({
  page,
  context,
}, info) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
    "Designated fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(300000);
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  const users: string[] = [];
  const email = `billing-${randomUUID()}@example.invalid`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    users.push(
      ...(
        await db`insert into fkh_users(name,email) values('Synthetic billing administrator','billing-admin-ui@example.invalid'),('Synthetic resolved billing player',${email}) returning id`
      ).map((r) => r.id),
    );
    await db`insert into fkh_admin_users(user_id,role,status) values(${users[0]},'owner','active')`;
    const subscription = (
      await db`insert into fkh_subscriptions(user_id,plan_key,status,current_period_end,cancel_at_period_end) values(${users[1]},'pro','past_due','2027-01-01',true) returning id`
    )[0].id;
    const entitlement = (
      await db`insert into fkh_entitlements(user_id,entitlement_key,source,value_json) values(${users[1]},'synthetic_access','synthetic_fixture',${db.json({ value: true, details: "Synthetic complete entitlement evidence" })}) returning id`
    )[0].id;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: users[0], email: "billing-admin-ui@example.invalid" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=%2Fadmin%2Fbilling`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", { name: "Billing and entitlements", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        await page.getByRole("textbox", { name: "Account email", exact: true }).fill(email);
        await page.getByRole("button", { name: "Find account", exact: true }).click();
        const grant = page.getByRole("dialog", {
          name: "Lifetime Full for Synthetic resolved billing player",
        });
        await expect(grant).toBeVisible({ timeout: 60000 });
        await expect(grant).toContainText(users[1]);
        const form = grant.getByRole("form", { name: "Grant lifetime full", exact: true });
        await form.getByRole("button", { name: "Review grant lifetime full", exact: true }).click();
        await form.getByRole("button", { name: "Cancel review", exact: true }).click();
        await page.keyboard.press("Escape");
        await expect(grant).toHaveCount(0);
        expect(await db`select id from fkh_subscriptions where user_id=${users[1]}`).toHaveLength(
          1,
        );
        expect(await db`select id from fkh_entitlements where user_id=${users[1]}`).toHaveLength(1);
        const subscriptions = page.getByRole("region", { name: "Subscriptions", exact: true });
        await subscriptions
          .getByRole("textbox", { name: "Search subscriptions", exact: true })
          .fill(email);
        await subscriptions
          .getByRole("button", { name: `Details for Subscriptions ${subscription}`, exact: true })
          .click();
        const detail = page.getByRole("dialog", {
          name: "Synthetic resolved billing player",
          exact: true,
        });
        await expect(detail).toContainText("past_due");
        await expect(detail).toContainText("Scheduled at period end");
        await expect(detail).toContainText("2027-01-01");
        await page.keyboard.press("Escape");
        await expect(detail).toHaveCount(0);
        const entitlements = page.getByRole("region", {
          name: "Current entitlements",
          exact: true,
        });
        await entitlements
          .getByRole("textbox", { name: "Search current entitlements", exact: true })
          .fill(email);
        await entitlements
          .getByRole("button", {
            name: `Details for Current entitlements ${entitlement}`,
            exact: true,
          })
          .click();
        await expect(detail).toContainText("Synthetic complete entitlement evidence");
        await expect(detail).toContainText("synthetic_fixture");
        await page.keyboard.press("Escape");
        await expect(detail).toHaveCount(0);
        await expect(
          page.locator(
            '[data-slot="drawer-content"], [data-slot="sheet-content"], [data-slot="drawer-overlay"], [data-slot="sheet-overlay"]',
          ),
        ).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P79-${surface}-${width}.png`) });
      }
    expect(
      await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
    ).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)}`;
      await db`delete from fkh_billing_customers where user_id in ${db(users)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
