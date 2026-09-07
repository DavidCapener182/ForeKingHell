import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Companion import entry preserves source and full CSV workspace at every width", async ({
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
  test.setTimeout(180000);
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => console.log("PAGE ERROR", error.stack));
  page.on("response", async (response) => {
    if (!response.url().includes("/_next/") || !response.url().split("?")[0].endsWith(".js"))
      return;
    try {
      const body = await response.text();
      try {
        new Script(body);
      } catch (error) {
        console.log("INVALID SCRIPT", response.url(), String(error), "bytes", body.length);
      }
    } catch {}
  });
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] = await db`insert into fkh_users(name) values('UI impact isolated') returning id`;
    owner = user.id;
    const [session] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'rapsodo','range','2026-09-01','Impact synthetic session','synthetic') returning id`;
    const [club] =
      await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},'7i','ui-impact-7i') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) values(${owner!},${session.id},${club.id},'7i',1,150,160,-3,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',2,155,165,4,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',3,160,170,7,'good','stock','included','2026-09-01','{}'::jsonb)`;
    const original =
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "impact@forekinghell.local" }),
      "playwright",
    ].join(".");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("/surface/companion?next=/companion-runtime/import");
      await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible();
      await expect(page.getByText("rapsodo · Saved practice evidence")).toBeVisible();
      await expect(page.locator(`a[href="/sessions/${session.id}"]`).first()).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Choose CSV files", exact: true }),
      ).toHaveAttribute("href", /source=csv/);
      await page.screenshot({
        path: info.outputPath(`P39-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      await page.goto("/companion-runtime/import/csv");
      await expect(
        page.getByRole("button", { name: "Quick range import", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("[data-import-ready]")).toHaveCount(0);
      await page.getByRole("button", { name: "Full import workflow", exact: true }).click();
      await expect(page.locator('[data-import-ready="true"]')).toBeVisible({ timeout: 60000 });
      await page.getByRole("button", { name: "Quick range import", exact: true }).click();
      await expect(page.locator('[data-import-ready="true"]')).toHaveCount(1);
      await expect(page.locator('[data-import-ready="true"]')).toBeHidden();
      await page.getByRole("button", { name: "Full import workflow", exact: true }).click();
      await expect(page.locator('[data-import-ready="true"]')).toBeVisible();
      await page.goto("/companion-runtime/import/csv?source=sample");
      await expect(page.locator('[data-import-ready="true"]')).toBeVisible({ timeout: 60000 });
      await expect(page.locator("[data-import-shot-preview]")).toContainText("5 parsed shots");
      await expect(page.getByRole("button", { name: "Save import", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Quick range import", exact: true }).click();
      await page.getByRole("button", { name: "Full import workflow", exact: true }).click();
      await expect(page.locator("[data-import-shot-preview]")).toContainText("5 parsed shots");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBeTruthy();
      await page.screenshot({
        path: info.outputPath(`P40-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
