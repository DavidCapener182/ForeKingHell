import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("progress preserves round resume and shot correction with refreshed evidence", async ({
  browser,
}) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      baseURL !== "http://localhost:3116",
    "Exact designated disposable fixture only",
  );
  test.setTimeout(240000);
  const db = postgres(value!, { max: 1 });
  let owner = "";
  try {
    owner = (
      await db`insert into fkh_users(name) values('Progress retained actions fixture') returning id`
    )[0].id;
    const [driver, iron] =
      await db`insert into fkh_clubs(user_id,type,brand,normalized_club_key) values(${owner},'driver','Fixture','retained-driver'),(${owner},'7i','Fixture','retained-iron') returning id`;
    const [practice] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text,play_context) values(${owner},'rapsodo','range','2026-09-22T12:00:00Z','Retained practice.csv','Synthetic','outdoor') returning id`;
    const shots =
      await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,shot_category,play_context,carry_yd,total_yd,side_carry_yd,ball_speed_mph,source_raw_json) select ${owner},${practice.id},${driver.id},'driver','2026-09-22T12:00:00Z',x,'full','outdoor',200,220,8,130,'{}'::jsonb from generate_series(1,12) as x returning id`;
    const [round] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text,round_status,course_name,scorecard_json) values(${owner},'manual','real_round','2026-09-23T12:00:00Z','Retained round','Synthetic','in_progress','Fixture course','[{"holeNumber":1,"par":4,"yards":350,"score":4}]'::jsonb) returning id`;
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const token = [encode({ alg: "none" }), encode({ sub: owner }), "playwright"].join(".");
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    try {
      for (const surface of ["workbench", "companion"]) {
        await page.goto(`/surface/${surface}?next=%2Ftoday`);
        await expect(page.locator("main h2").first()).toHaveText("Am I improving?");
        const resume = page.getByRole("link", { name: /^Continue round/ });
        await expect(resume).toHaveAttribute("href", `/rounds/${round.id}`);
        await resume.click();
        await expect(page).toHaveURL(new RegExp(`/rounds/${round.id}`), { timeout: 60000 });
        await expect(page.locator("main")).toContainText("Fixture course", { timeout: 60000 });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        `/surface/companion?next=${encodeURIComponent(`/shots?sessionId=${practice.id}`)}`,
      );
      await page
        .getByRole("button", { name: /200 yards carry.*view shot/ })
        .first()
        .click();
      const correction = page
        .locator("details")
        .filter({ has: page.locator("summary").filter({ hasText: /^Correct club$/ }) });
      await correction.locator("summary").click();
      await correction.getByRole("combobox").selectOption(iron.id);
      await correction.getByRole("button", { name: "Update club", exact: true }).click();
      await expect(correction.getByRole("status")).toContainText("Club updated");
      expect(
        await db`select id from fkh_shots where id in ${db(shots.map((s) => s.id))} and club_id=${iron.id}`,
      ).toHaveLength(1);
      await page.goto(`/today?session=${practice.id}&cpClub=${driver.id}&cpMetric=carryYd`);
      await expect(page.locator("[data-progress-cards]")).toContainText("11 readings");
      await page
        .locator("[data-club-progress]")
        .getByRole("button", { name: "Irons", exact: true })
        .click();
      await expect(page.locator("[data-progress-cards]")).toContainText("1 readings");
      await expect(page.locator("[data-progress-cards]")).toContainText("200.0 yd");
      await page.goto(`/shots?sessionId=${practice.id}`);
      await page
        .getByRole("button", { name: /200 yards carry.*view shot/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Exclude from stats", exact: true }).click();
      await page.locator("[data-shot-review-confirm]").click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      const reviewed =
        await db`select id from fkh_shots where session_id=${practice.id} and review_status='user_excluded'`;
      expect(reviewed).toHaveLength(1);
      await page.getByRole("button", { name: "Restore shot", exact: true }).click();
      await page.locator("[data-shot-review-confirm]").click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
      expect(
        (await db`select review_status from fkh_shots where id=${reviewed[0].id}`)[0].review_status,
      ).toBe("restored");
    } finally {
      await context.close();
    }
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
