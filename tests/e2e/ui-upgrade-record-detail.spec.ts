import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Record detail saves exact owned round and truthful receipt on both surfaces", async ({
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
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/course-records/${board.id}?attempt=${crypto.randomUUID()}`)}`,
        );
        await expect(page.getByText(/No new save is confirmed by this link/)).toBeVisible();
        const form = page.locator("[data-course-record-attempt-form]");
        await expect(form.locator("[data-record-derived-score]")).toContainText("90");
        await form.getByRole("button", { name: "Review attempt", exact: true }).click();
        await form.getByRole("button", { name: "Submit reviewed attempt", exact: true }).click();
        await expect(page.getByRole("heading", { name: /Attempt saved/ })).toBeVisible();
        await expect(
          page
            .getByRole("status")
            .filter({ has: page.getByRole("heading", { name: /Attempt saved/ }) }),
        ).toContainText("90 strokes");
        const attemptId = new URL(page.url()).searchParams.get("attempt");
        const [attempt] =
          await db`select user_id,session_id,metric_value,verification_status,metadata_json from fkh_course_record_attempts where id=${attemptId!}`;
        expect(attempt.user_id).toBe(owner);
        expect(attempt.session_id).toBe(round.id);
        expect(Number(attempt.metric_value)).toBe(90);
        expect(attempt.verification_status).not.toBe("verified");
        await expect(
          page.getByText("This is not yet a verified record.", { exact: false }).first(),
        ).toBeVisible();
        await page.reload();
        await expect(page.getByRole("heading", { name: /Attempt saved/ })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P57-${surface}-${width}.png`),
          animations: "disabled",
          fullPage: true,
        });
      }
    const [unchanged] =
      await db`select scorecard_json,raw_csv_text from fkh_sessions where id=${round.id}`;
    expect(unchanged).toEqual({ scorecard_json: scorecard, raw_csv_text: "unchanged proof round" });
    expect(
      await db`select id from fkh_course_record_attempts where record_id=${board.id}`,
    ).toHaveLength(baseline.length + 12);
    expect(
      await db`select distinct metadata_json->>'requestId' as request_id from fkh_course_record_attempts where record_id=${board.id} and metadata_json ? 'requestId'`,
    ).toHaveLength(12);
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
