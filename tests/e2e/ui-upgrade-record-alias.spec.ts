import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Course record alias preserves exact identity query and public destination", async ({
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
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] = await db`insert into fkh_users(name) values('UI impact isolated') returning id`;
    owner = user.id;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "records@forekinghell.local" }),
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
      await db`insert into fkh_courses(name,country,visibility,created_by_user_id) values('Synthetic record course with long championship identity','United Kingdom','private',${owner!}) returning id`;
    await db`insert into fkh_tee_sets(course_id,name,par,yards) values(${course.id},'Synthetic record tee',72,6000)`;
    const [tee] = await db`select id from fkh_tee_sets where course_id=${course.id} limit 1`;
    const scorecard = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      score: 5,
      yards: 300,
    }));
    const [round] =
      await db`insert into fkh_sessions(user_id,source,type,date,course_id,tee_set_id,course_name,scorecard_json,raw_csv_text) values(${owner!},'manual','real_round','2026-09-02',${course.id},${tee.id},'Synthetic record course',${db.json(scorecard)},'unchanged proof round') returning id`;
    await page.goto(`/courses/${course.id}/records`);
    const [board] =
      await db`select id from fkh_course_records where course_id=${course.id} and record_type='best_gross_score' and period='all_time' and scope='public' limit 1`;
    expect(board).toBeTruthy();
    const baseline =
      await db`select id,source_kind,proof_status,metadata_json from fkh_course_record_attempts where record_id=${board.id}`;
    expect(baseline).toHaveLength(1);
    expect(baseline[0]).toMatchObject({
      source_kind: "manual_scorecard",
      proof_status: "manual_only",
      metadata_json: expect.objectContaining({ autoSyncedFromVerifiedRound: true }),
    });

    for (const surface of ["workbench", "companion"]) {
      await context.addCookies([
        { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
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
        await page.goto(`/courses/${course.id}/records/${board.id}?filter=a&filter=b`, {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        });
        await expect(page).toHaveURL(
          new RegExp(`/course-records/${board.id}\\?filter=a&filter=b$`),
          { timeout: 90000 },
        );
        await expect(page.locator("[data-course-record-attempt-form]")).toBeVisible({
          timeout: 60000,
        });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P93-${surface}-${width}.png`) });
        if (width === 390) {
          await page.reload();
          await expect(page.locator("[data-course-record-attempt-form]")).toBeVisible();
          await page.goto("/privacy");
          await page.goBack();
          await expect(page).toHaveURL(
            new RegExp(`/course-records/${board.id}\\?filter=a&filter=b$`),
          );
        }
      }
    }
    expect(
      await db`select id from fkh_course_record_attempts where record_id=${board.id}`,
    ).toHaveLength(baseline.length);
    expect(errors).toEqual([]);
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
