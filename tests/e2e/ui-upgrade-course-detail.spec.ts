import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Course detail exposes complete history and saves the selected favourite", async ({
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
    const [course] =
      await db`insert into fkh_courses(name,visibility,created_by_user_id) values('Synthetic complete course detail with a long identity','private',${owner!}) returning id`;
    const [tee] =
      await db`insert into fkh_tee_sets(course_id,name,par,course_rating,slope_rating,yards) values(${course.id},'Synthetic exact tee',72,71.5,123,6000) returning id`;
    const scorecard = Array.from({ length: 9 }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      score: 5,
      yards: 300,
    }));
    const [round] =
      await db`insert into fkh_sessions(user_id,source,type,date,course_id,tee_set_id,course_name,scorecard_json,raw_csv_text) values(${owner!},'manual','real_round','2026-09-02',${course.id},${tee.id},'Synthetic exact course round',${JSON.stringify(scorecard)}::jsonb,'unchanged course round') returning id`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=${encodeURIComponent(`/courses/${course.id}`)}`);
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        const nav = page.getByRole("navigation", { name: "Course detail", exact: true });
        await nav.getByRole("link", { name: "Overview", exact: true }).click();
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Synthetic complete course detail with a long identity",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByText("Par 72 · 6000 yd · Rating 71.5 · Slope 123", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Finish course setup", exact: true }),
        ).toHaveAttribute("href", `/courses/${course.id}/holes`);
        await nav.getByRole("link", { name: "Rounds", exact: true }).click();
        if (width < 768) await page.locator("summary").filter({ hasText: "45 strokes" }).click();
        await expect(page.getByText("Synthetic exact course round", { exact: true })).toBeVisible();
        expect(await page.locator(`a[href="/rounds/${round.id}"]`).count()).toBeGreaterThan(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P48-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await nav.getByRole("link", { name: "Course Twin", exact: true }).click();
        await expect(page.getByText("Course Twin is not ready yet", { exact: true })).toBeVisible();
      }
      await page
        .getByRole("button", {
          name: "Favourite Synthetic complete course detail with a long identity",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Remove Synthetic complete course detail with a long identity from favourites",
          exact: true,
        }),
      ).toBeEnabled();
      expect(
        (
          await db`select course_id from fkh_course_favourites where user_id=${owner!} and course_id=${course.id}`
        ).length,
      ).toBe(1);
      await page
        .getByRole("button", {
          name: "Remove Synthetic complete course detail with a long identity from favourites",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Favourite Synthetic complete course detail with a long identity",
          exact: true,
        }),
      ).toBeEnabled();
    }
    expect(
      (await db`select raw_csv_text from fkh_sessions where id=${round.id}`)[0].raw_csv_text,
    ).toBe("unchanged course round");
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
