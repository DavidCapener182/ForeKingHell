import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
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
    await db`insert into fkh_admin_audit_log(actor_user_id,action,target_type,target_id,created_at,metadata_json)
      select ${users[0]}, 'system_snapshot_checked', 'system_snapshot', 'stored-operational-records',
      '2090-01-01'::timestamptz, '{"scope":"stored operational records","operations":{"billingFailures":0},"liveProvidersChecked":false}'::jsonb
      from generate_series(1,82)`;
    const syntheticProbes = [
      {
        id: "database-read",
        label: "Database read connection",
        state: "passed",
        checkedAt: "2090-01-01T00:00:00.000Z",
        durationMs: 12,
        detail: "Synthetic read-only database response; not a user-policy check.",
      },
      {
        id: "auth-settings",
        label: "Auth settings endpoint",
        state: "failed",
        checkedAt: "2090-01-01T00:00:00.000Z",
        durationMs: 5000,
        detail: "Synthetic endpoint timeout; sign-in not exercised.",
      },
      {
        id: "storage-buckets",
        label: "Storage bucket metadata",
        state: "unavailable",
        checkedAt: "2090-01-01T00:00:00.000Z",
        durationMs: 0,
        detail: "Synthetic unconfigured credential; no request sent.",
      },
    ];
    await db`update fkh_admin_audit_log set metadata_json = metadata_json || ${db.json({ liveChecks: syntheticProbes })}::jsonb where actor_user_id=${users[0]} and created_at='2090-01-01'`;
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
        if (process.env.ADMIN_PROBE_VISUAL_ONLY === "1" && ![360, 390].includes(width)) continue;
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=%2Fadmin%2Fsystem-checks`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", { name: "System health console", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        const probes = page.getByRole("region", { name: "Read-only live probes", exact: true });
        await expect(probes).toContainText("Probe passed");
        await expect(probes).toContainText("Probe failed");
        await expect(probes).toContainText("Unavailable");
        await expect(probes).toContainText("5000 ms");
        await probes.screenshot({ path: info.outputPath(`P81-probes-${surface}-${width}.png`) });
        for (const latency of await probes.locator("[data-probe-latency]").all()) {
          await expect(latency).toHaveCSS("white-space", "nowrap");
          const box = await latency.boundingBox();
          expect(box?.height).toBeLessThan(20);
        }
        if (process.env.ADMIN_PROBE_VISUAL_ONLY === "1") {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
          continue;
        }
        const search = page.getByRole("textbox", { name: "Search checks", exact: true });
        await expect(search).toBeEnabled({ timeout: 60000 });
        await search.fill("Authentication");
        const register = page.getByRole("region", { name: "Health register", exact: true });
        await expect(page).toHaveURL(/healthQuery=Authentication/);
        await register.getByRole("button", { name: /^Columns/ }).click();
        await page.getByRole("menuitemcheckbox", { name: "Last check", exact: true }).click();
        await page.keyboard.press("Escape");
        await expect(
          register.locator('[data-column="lastCheck"]').filter({ visible: true }),
        ).toHaveCount(0);
        const viewName = `Authentication ${surface} ${width}`;
        await register.getByRole("button", { name: "Saved views", exact: true }).click();
        await page.getByRole("menuitem", { name: "Save current view", exact: true }).click();
        const saveView = page.getByRole("dialog", { name: "Save table view" });
        await saveView.getByRole("textbox", { name: "View name" }).fill(viewName);
        await saveView.getByRole("button", { name: "Save view", exact: true }).click();
        await search.fill("Billing");
        await register.getByRole("button", { name: /^Columns/ }).click();
        await page.getByRole("menuitem", { name: "Show all columns", exact: true }).click();
        await register.getByRole("button", { name: "Saved views", exact: true }).click();
        await page.locator('a[role="menuitem"]').filter({ hasText: viewName }).click();
        await expect(search).toHaveValue("Authentication");
        await page.reload();
        await expect(search).toHaveValue("Authentication");
        await expect(
          register.locator('[data-column="lastCheck"]').filter({ visible: true }),
        ).toHaveCount(0);
        const downloadReady = page.waitForEvent("download");
        await register.locator('[data-export-table-id="admin-system-health"]').click();
        const download = await downloadReady;
        const csv = await readFile((await download.path())!, "utf8");
        expect(csv).toContain("Authentication availability");
        expect(csv).not.toContain("Billing");
        expect(csv).not.toContain("Last check");
        await register.getByRole("button", { name: /^Columns/ }).click();
        await page.getByRole("menuitem", { name: "Show all columns", exact: true }).click();

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
        await expect(refresh).toContainText("are not exercised");
        await refresh.getByRole("button", { name: "Cancel refresh", exact: true }).click();
        await expect(refresh).toHaveCount(0);
        if (
          surface === "workbench" &&
          width === 1440 &&
          process.env.SKIP_ADMIN_PROBE_REQUESTS !== "1"
        ) {
          expect(
            await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
          ).toHaveLength(83);
          await page.getByRole("button", { name: "Refresh recorded checks", exact: true }).click();
          await refresh
            .getByRole("button", { name: "Confirm recorded-check refresh", exact: true })
            .click();
          await expect(refresh).toHaveCount(0, { timeout: 60000 });
          await expect(
            page.getByRole("status").filter({ hasText: "Checks saved at" }),
          ).toBeVisible();
          expect(
            await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
          ).toHaveLength(84);
        }
        await search.fill("Billing");
        await expect(page).toHaveURL(/healthQuery=Billing/);
        const history = page.getByRole("region", { name: "Recorded check history", exact: true });
        await expect(history).toContainText("Page 1 of 5");
        for (let number = 2; number <= 5; number++) {
          await history.getByRole("link", { name: "Older checks", exact: true }).click();
          await expect(history).toContainText(`Page ${number} of 5`);
          await expect(page).toHaveURL(new RegExp(`checkPage=${number}`));
          await expect(search).toHaveValue("Billing");
        }
        await page.reload();
        await expect(history).toContainText("Page 5 of 5");
        await expect(search).toHaveValue("Billing");
        const old = history.locator("details").filter({ hasText: historic });
        await old.locator("summary").click();
        await expect(old).toContainText('"billingFailures": 7');
        await expect(old).toContainText('"liveProvidersChecked": false');
        await old.locator("summary").click();
        await history.getByRole("link", { name: "Newer checks", exact: true }).click();
        await expect(history).toContainText("Page 4 of 5");
        await expect(search).toHaveValue("Billing");
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
    ).toHaveLength(process.env.SKIP_ADMIN_PROBE_REQUESTS === "1" ? 83 : 84);
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
