import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
test("System checks preserve unknown health and dated recorded failures across both surfaces", async ({
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
    const historic = (
      await db`insert into fkh_admin_audit_log(actor_user_id,action,target_type,target_id,created_at,metadata_json) values(${users[0]},'system_snapshot_checked','system_snapshot','stored-operational-records','2026-01-01',${db.json({ scope: "stored operational records", operations: { billingFailures: 7 }, liveProvidersChecked: false })}) returning id`
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
        await page.goto(`/surface/${surface}?next=%2Fadmin%2Fsystem-checks`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", { name: "System health console", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        const search = page.getByRole("textbox", { name: "Search checks", exact: true });
        await expect(search).toBeEnabled({ timeout: 60000 });
        await search.fill("Authentication");
        await page
          .getByRole("button", { name: "Inspect Authentication availability", exact: true })
          .click();
        const panel = page.getByRole("dialog", {
          name: "Authentication availability",
          exact: true,
        });
        await expect(panel).toContainText("No live verification result");
        await expect(panel).toContainText("Not checked");
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await page.getByRole("button", { name: "Refresh recorded checks", exact: true }).click();
        const refresh = page.getByRole("dialog", { name: "Refresh recorded checks", exact: true });
        await expect(refresh).toContainText("remain unverified");
        await refresh.getByRole("button", { name: "Cancel refresh", exact: true }).click();
        await expect(refresh).toHaveCount(0);
        if (surface === "workbench" && width === 1440) {
          expect(
            await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
          ).toHaveLength(1);
          await page.getByRole("button", { name: "Refresh recorded checks", exact: true }).click();
          await refresh
            .getByRole("button", { name: "Confirm recorded-check refresh", exact: true })
            .click();
          await expect(refresh).toHaveCount(0, { timeout: 60000 });
          await expect(
            page.getByRole("status").filter({ hasText: "Recorded checks refreshed" }),
          ).toBeVisible();
          expect(
            await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
          ).toHaveLength(2);
        }
        const history = page.getByRole("region", { name: "Recorded check history", exact: true });
        const old = history.locator("details").filter({ hasText: historic });
        await old.locator("summary").click();
        await expect(old).toContainText('"billingFailures": 7');
        await expect(old).toContainText('"liveProvidersChecked": false');
        await old.locator("summary").click();
        await expect(
          page.locator(
            '[data-slot="drawer-content"], [data-slot="sheet-content"], [data-slot="drawer-overlay"], [data-slot="sheet-overlay"]',
          ),
        ).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P81-${surface}-${width}.png`) });
      }
    expect(
      await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
    ).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
