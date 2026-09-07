import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Strokes gained filters and event proof work on both surfaces", async ({
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
    await db`update fkh_sessions set type='round',course_name='Synthetic SG course' where id=${session.id}`;
    await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,start_distance_yd,end_distance_yd,hole_number,stroke_number,strokes_gained) values (${owner!},${session.id},'tee','tee','fairway',400,150,1,1,1),(${owner!},${session.id},'approach','fairway','green',150,5,1,2,-2),(${owner!},${session.id},'putting','green','holed',5,0,1,3,null)`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=/strokes-gained`);
      await expect(page.getByRole("heading", { name: "Strokes gained", exact: true })).toBeVisible({
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
        await expect(page.getByText("2 / 3 events calculated", { exact: false })).toBeVisible();
        await expect(
          page.getByRole("img", { name: "Strokes gained waterfall", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Filters (0)", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("combobox", { name: "Round", exact: true })).toBeVisible();
        await expect(dialog.getByLabel("From", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Cancel filters", exact: true }).click();
        if (width < 1024) {
          await page
            .getByRole("textbox", { name: "Search event evidence", exact: true })
            .fill("approach");
          await expect(page.getByText("1 matching loaded events", { exact: true })).toBeVisible();
          await page.getByRole("button", { name: /Synthetic SG course.*Approach/ }).click();
          await expect(page.getByRole("dialog")).toContainText(
            "Expected before (current baseline)",
          );
          await expect(page.getByRole("dialog")).toContainText("Penalty strokes");
          await page.getByRole("button", { name: "Close event", exact: true }).click();
          await page.getByRole("textbox", { name: "Search event evidence", exact: true }).fill("");
        }
        await expect(page.locator("h1:visible")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P28-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.getByRole("button", { name: "Filters (0)", exact: true }).click();
      await page.getByRole("dialog").getByLabel("From", { exact: true }).fill("2026-09-01");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Apply filters", exact: true })
        .click();
      await expect(page).toHaveURL(/from=2026-09-01/);
      await page
        .getByRole("navigation", { name: "Strokes gained views", exact: true })
        .getByRole("link", { name: "Approach", exact: true })
        .click();
      await expect(page).toHaveURL(/from=2026-09-01/);
      await expect(page).toHaveURL(/category=approach/);
      await expect(
        page.getByRole("heading", { name: "Approach strokes gained", exact: true }),
      ).toBeVisible({ timeout: 60000 });
    }
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
