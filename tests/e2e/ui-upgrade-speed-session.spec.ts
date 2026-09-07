import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Speed session has full editable evidence on both surfaces", async ({
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
  page.on("pageerror", error => console.log("PAGE ERROR",error.message));
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
    let original =
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
    const [speed] =
      await db`insert into fkh_speed_training_sessions(user_id,club_id,session_date,title,implement_label,avg_speed_mph,min_speed_mph,max_speed_mph,swing_count) values(${owner!},${club.id},'2026-09-01','Synthetic speed detail','7i',81,80,82,3) returning id`;
    for (const [index, value] of [80, 81, 82].entries())
      await db`insert into fkh_speed_training_swings(user_id,speed_session_id,swing_number,club_speed_mph) values(${owner!},${speed.id},${index + 1},${value})`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent(`/speed/sessions/${speed.id}`)}`,
      );
      await expect(page.locator('[data-url-tabs][data-ready="true"]')).toBeVisible({
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
        await page.getByRole("tab", { name: "Readings & fatigue", exact: true }).click();
        await page.getByRole("combobox", { name: "Selected swing", exact: true }).selectOption("2");
        await expect(
          page.getByRole("status").filter({ hasText: "Swing 2: 81.0 mph" }),
        ).toBeVisible();
        await page.getByRole("button", { name: /^Swing 1 80/ }).click();
        await expect(page.getByRole("dialog")).toContainText("Not recorded");
        await page.getByRole("button", { name: /Close.*details/ }).click();
        await page.getByRole("tab", { name: "Edit session", exact: true }).click();
        const title = page.getByRole("textbox", { name: "Title", exact: true });
        await title.fill("Retained speed draft");
        await page.getByRole("tab", { name: "Readings & fatigue", exact: true }).click();
        await page.getByRole("tab", { name: "Edit session", exact: true }).click();
        await expect(title).toHaveValue("Retained speed draft");
        await page.getByRole("button", { name: "Delete session", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Synthetic speed detail");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("tab", { name: "Ball transfer", exact: true }).click();
        await page.getByRole("tab", { name: "Readings & fatigue", exact: true }).click();
        await expect(page.locator("h1:visible")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P31-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await page.getByRole("tab", { name: "Edit session", exact: true }).click();
    await page.getByRole("textbox", { name: "Target", exact: true }).fill("9999");
    await page.getByRole("button", { name: "Save session changes", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "Retained speed draft",
    );
    await page.getByRole("textbox", { name: "Target", exact: true }).fill("90");
    await page
      .getByRole("textbox", { name: "Maximum-speed swings", exact: true })
      .fill("81.5 83.5 85.5");
    await page.getByRole("button", { name: "Save session changes", exact: true }).click();
    await expect(page.getByText("Session changes saved.", { exact: false })).toBeVisible();
    const readings =
      await db`select club_speed_mph from fkh_speed_training_swings where speed_session_id=${speed.id} order by swing_number`;
    expect(readings.map((r) => r.club_speed_mph)).toEqual([81.5, 83.5, 85.5]);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
