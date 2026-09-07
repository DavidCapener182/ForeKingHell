import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Speed Centre saves exact readings and retains validation drafts on both surfaces", async ({
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
    await db`update fkh_shots set club_speed_mph=80 where user_id=${owner!}`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,club_speed_mph,quality_tag,shot_category,review_status,shot_at,source_raw_json) select user_id,session_id,club_id,club_type,shot_number+3,carry_yd,total_yd,side_carry_yd,80,quality_tag,shot_category,review_status,shot_at,source_raw_json from fkh_shots where user_id=${owner!}`;
    await db`insert into fkh_speed_training_sessions(user_id,club_id,session_date,title,implement_label,avg_speed_mph,min_speed_mph,max_speed_mph,swing_count) values(${owner!},${club.id},'2026-08-25','Synthetic previous speed','7i',80,79,81,3)`;
    original =
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
    await db`insert into fkh_stock_yardages(user_id,club_id,sample_size,carry_median_yd,recommended_play_number_yd,confidence_score) values(${owner!},${club.id},6,155,155,70)`;
    let created = false;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=/speed`);
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
        await page.getByRole("tab", { name: "Club focus", exact: true }).click();
        await page.getByRole("button", { name: /Speed club focus/ }).click();
        await expect(page.getByRole("dialog")).toContainText(
          "targets, projections and source evidence",
        );
        await page.getByRole("button", { name: "Close club search", exact: true }).click();
        await page.getByRole("tab", { name: "Targets", exact: true }).click();
        const target = page.getByRole("textbox", { name: "Driver goal (mph)", exact: true });
        if (!created) {
          await target.fill("9997");
          await page.getByRole("button", { name: "Save speed goals", exact: true }).click();
          await expect(
            page.locator("form").filter({ has: target }).getByRole("alert"),
          ).toBeVisible();
          await expect(target).toHaveValue("9997");
          await target.fill("110");
          await page.getByRole("button", { name: "Save speed goals", exact: true }).click();
          await expect(page.getByText("Speed goals saved.", { exact: true })).toBeVisible();
        }
        await page.getByRole("tab", { name: "Log & sync", exact: true }).click();
        if (!created) {
          await page
            .getByRole("textbox", { name: "Title", exact: true })
            .fill("UI exact speed session");
          await page
            .getByRole("combobox", { name: "Club used", exact: true })
            .selectOption(club.id);
          await page.getByRole("textbox", { name: /Warm-up swings/ }).fill("60 65");
          await page
            .getByRole("textbox", { name: "Maximum-speed swings (mph)", exact: true })
            .fill("80.5 82.1");
          await page
            .getByRole("textbox", { name: "Add a reading (mph)", exact: true })
            .fill("83.7");
          await page.getByRole("button", { name: "Add reading", exact: true }).click();
          await page.getByRole("button", { name: "Save speed session", exact: true }).click();
          await expect(
            page.getByRole("link", { name: "Open saved session", exact: true }),
          ).toBeVisible({ timeout: 60000 });
          await expect(
            page.getByRole("button", { name: "Save speed session", exact: true }),
          ).toBeDisabled();
          created = true;
        }
        await page.getByRole("button", { name: "Connect R-Cloud", exact: true }).click();
        await expect(
          page.getByRole("dialog").getByRole("textbox", { name: "Rapsodo email", exact: true }),
        ).toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("tab", { name: "Evidence & projections", exact: true }).click();
        const projection = page.getByRole("spinbutton", { name: /Target.*speed \(mph\)/ }).first();
        await expect(projection).toBeVisible();
        const current = await projection.inputValue();
        const adjusted = String(Number(current) + 0.1);
        await projection.fill(adjusted);
        await page.getByRole("tab", { name: "Club focus", exact: true }).click();
        await page.getByRole("tab", { name: "Evidence & projections", exact: true }).click();
        await expect(projection).toHaveValue(adjusted);
        await page.getByRole("button", { name: "Reset projection", exact: true }).click();
        await expect(projection).toHaveValue(current);
        await page.getByRole("tab", { name: "Train", exact: true }).click();
        await expect(page.locator("[data-mobile-speed]")).toBeVisible();
        await expect(page.locator("h1:visible")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P30-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.goto(
        `/surface/companion?next=${encodeURIComponent(`/companion-runtime/import/result?sessionId=${session.id}`)}`,
      );
      await page.locator("summary").filter({ hasText: "saved shots · review and correct" }).click();
      await page.getByRole("button", { name: "Full evidence", exact: true }).first().click();
      const evidence = page.getByRole("dialog");
      await expect(evidence.getByRole("tab", { name: "Source", exact: true })).toBeVisible();
      await evidence.getByRole("tab", { name: "Source", exact: true }).click();
      await evidence.locator("summary").filter({ hasText: "Correct club" }).click();
      await expect(evidence.getByRole("combobox", { name: "Club", exact: true })).toBeVisible();
      await evidence.getByRole("button", { name: "Close evidence", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    const saved =
      await db`select id,max_speed_mph,swing_count from fkh_speed_training_sessions where user_id=${owner!} and title='UI exact speed session'`;
    expect(saved).toHaveLength(1);
    expect(saved[0].max_speed_mph).toBe(83.7);
    expect(saved[0].swing_count).toBe(5);
    const readings =
      await db`select club_speed_mph from fkh_speed_training_swings where speed_session_id=${saved[0].id} order by swing_number`;
    expect(readings.map((row) => row.club_speed_mph)).toEqual([60, 65, 80.5, 82.1, 83.7]);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
