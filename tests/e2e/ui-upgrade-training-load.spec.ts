import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Training Load keeps range and complete entry workflow on both surfaces", async ({
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
  page.on("pageerror", (error) => console.log("PAGE ERROR", error.message));
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
    await db`insert into fkh_golf_training_sessions(user_id,source_type,title,session_date,rpe,session_load,duration_minutes) values(${owner!},'manual','Recent synthetic practice','2026-09-06',5,100,30),(${owner!},'manual','Older synthetic practice','2026-08-01',5,90,25)`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent("/stats/training-over-time")}`,
      );
      await expect(page.getByRole("button", { name: /History range:/ })).toBeVisible({
        timeout: 60000,
      });
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.getByRole("button", { name: /History range:/ }).click();
        await page
          .getByRole("combobox", { name: "History window", exact: true })
          .selectOption("7d");
        await page.getByRole("button", { name: "Apply range", exact: true }).click();
        await expect(page).toHaveURL(/range=7d/);
        await expect(
          page.getByRole("status").filter({ hasText: "1 logged entries" }),
        ).toBeVisible();
        await page.getByRole("button", { name: /^Recent synthetic practice/ }).click();
        await expect(page.getByRole("dialog")).toContainText("manual");
        await page.getByRole("button", { name: "Close details", exact: true }).click();
        await page.locator("#log-training > summary").click();
        await page
          .getByRole("textbox", { name: "Title", exact: true })
          .fill("Preserved training draft");
        await page.locator("#log-training > summary").click();
        await page.locator("#log-training > summary").click();
        await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
          "Preserved training draft",
        );
        await page.locator("#log-training > summary").click();
        if (width < 1024) {
          await expect(page.locator("[data-mobile-training-chart]:visible")).toBeVisible();
          await page.getByRole("slider", { name: "Training day", exact: true }).press("Home");
        }
        await expect(page.locator("h1:visible")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: info.outputPath(`P32-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await page.locator("#log-training > summary").click();
    await page.getByRole("textbox", { name: "Duration minutes", exact: true }).fill("-1");
    await page.getByRole("button", { name: "Save training load", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "Preserved training draft",
    );
    await page.getByRole("textbox", { name: "Duration minutes", exact: true }).fill("30");
    await page.getByRole("button", { name: "Save training load", exact: true }).click();
    await expect(page.getByText("Training Load saved.", { exact: true })).toBeVisible();
    const saved =
      await db`select duration_minutes,rpe,session_load from fkh_golf_training_sessions where user_id=${owner!} and title='Preserved training draft'`;
    expect(saved).toHaveLength(1);
    expect(saved[0].duration_minutes).toBe(30);
    expect(Number(saved[0].rpe)).toBe(5);
    expect(Number(saved[0].session_load)).toBeGreaterThan(0);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
