import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("Today automatically reviews populated practice history on both surfaces", async ({
  browser,
}, info) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
    "Designated disposable fixture only",
  );
  test.skip(info.project.name !== "chromium", "Explicit desktop and mobile route coverage");
  test.setTimeout(240000);
  const db = postgres(value!, { max: 1 });
  let owner = "";
  const errors: string[] = [];
  const dateKey = (daysAgo: number) => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - daysAgo);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(day);
  };
  try {
    owner = (
      await db`insert into fkh_users(name) values('Today progress isolated fixture') returning id`
    )[0].id;
    const equipment = await db`insert into fkh_clubs(user_id,type,brand,model,normalized_club_key)
      values(${owner},'7i','Fixture','Iron','progress-iron'),
      (${owner},'driver','Fixture','Driver','progress-driver') returning id,type`;
    let latestSession: string | undefined;
    const dates = [6, 4, 2, 0];
    for (const [practiceIndex, daysAgo] of dates.entries()) {
      // Two files belong to the latest practice; they must form one dated review.
      const uploadCount = daysAgo === 0 ? 2 : 1;
      for (let upload = 0; upload < uploadCount; upload++) {
        const [session] =
          await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name)
          values(${owner},'rapsodo','range',${`${dateKey(daysAgo)}T12:00:00Z`},'Synthetic',${`Progress practice ${daysAgo}-${upload}.csv`}) returning id`;
        if (daysAgo === 0) latestSession = session.id;
        for (const club of equipment) {
          const carry = (club.type === "driver" ? [190, 200, 208, 216] : [140, 145, 150, 152])[
            practiceIndex
          ];
          const spread = [14, 10, 6, 2][practiceIndex];
          const offline = (club.type === "driver" ? [40, 30, 20, 8] : [24, 18, 12, 4])[
            practiceIndex
          ];
          for (let index = 0; index < 12 / uploadCount; index++) {
            const distance = carry + (index % 2 ? spread : -spread);
            await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,shot_number,
              carry_yd,total_yd,side_carry_yd,ball_speed_mph,launch_angle_deg,apex_ft,source_raw_json)
              values(${owner},${session.id},${club.id},${`${dateKey(daysAgo)}T12:00:00Z`},${club.type},${index + 1},
              ${distance},${distance + 10},${offline},${club.type === "driver" ? 140 : 110},15,70,'{}')`;
          }
        }
      }
    }
    await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,carry_yd,side_carry_yd,review_status,source_raw_json)
      values(${owner},${latestSession!},${equipment[0].id},${`${dateKey(0)}T12:01:00Z`},${equipment[0].type},1,200,'user_excluded','{}')`;
    // The most recent earlier calendar day is a round, not the previous practice.
    const [round] =
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name)
      values(${owner},'manual','round',${`${dateKey(1)}T12:00:00Z`},'Synthetic','Round distractor') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,carry_yd,side_carry_yd,source_raw_json)
      values(${owner},${round.id},${equipment[0].id},${`${dateKey(1)}T12:00:00Z`},${equipment[0].type},152,0,'{}')`;

    const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");
    const token = [encode({ alg: "none" }), encode({ sub: owner }), "playwright"].join(".");
    for (const surface of ["workbench", "companion"]) {
      const context = await browser.newContext({
        baseURL: "http://localhost:3116",
        viewport: { width: surface === "workbench" ? 1440 : 390, height: 900 },
      });
      try {
        await context.addCookies([
          {
            name: "sb-playwright-auth-token",
            value: encodeURIComponent(JSON.stringify({ access_token: token })),
            domain: "localhost",
            path: "/",
          },
        ]);
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(`${surface}: ${error.message}`));
        await page.goto(`/surface/${surface}?next=%2Ftoday`);
        const report = page.locator("[data-today-progress-report]");
        await expect(report).toBeVisible({ timeout: 60000 });
        await expect(report).toHaveAttribute("data-progress-verdict", "better");
        await expect(report).toContainText(/better|improv/i);
        await expect(report).toContainText(/recent|trend/i);
        await expect(report).toContainText(/7i|7 iron|7-iron/i);
        await expect(report).toContainText("Driver");
        await expect(report).toContainText("24");
        expect(
          await report.evaluate((element) => Boolean(element.closest('[role="tabpanel"]'))),
        ).toBe(false);
        await page.screenshot({ path: info.outputPath(`today-progress-${surface}.png`) });
        const workspace = page.locator("[data-today-workspace-tabs]");
        await expect(workspace).toHaveAttribute("data-ready", "true", { timeout: 60000 });
        await workspace.getByRole("tab", { name: "Evidence", exact: true }).click();
        await expect(workspace.getByRole("tabpanel")).toBeVisible();
        await expect(report).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
        if (surface === "workbench") {
          await page.goto("/today?club=driver");
          await expect(report.getByRole("heading", { level: 2 })).toContainText("Driver");
          await expect(report).not.toContainText("7i");
        }
        await report
          .locator(
            `a[href="/today?date=${dateKey(2)}${surface === "workbench" ? "&club=driver" : ""}"]`,
          )
          .click();
        await expect(report.locator("time").first()).toHaveAttribute("datetime", dateKey(2));
        if (surface === "companion") {
          await expect(page.getByText("Practice complete · Today", { exact: true })).toHaveCount(0);
        }
      } finally {
        await context.close();
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await info.attach("page-errors", {
      body: JSON.stringify(errors),
      contentType: "application/json",
    });
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
