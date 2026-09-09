import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("Today automatically reviews populated practice history on both surfaces", async ({
  browser,
}, info) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      !["http://localhost:3116", "http://localhost:3117"].includes(baseURL ?? ""),
    "Designated disposable fixture only",
  );
  test.skip(info.project.name !== "chromium", "Explicit desktop and mobile route coverage");
  test.setTimeout(240000);
  const db = postgres(value!, { max: 1 });
  let owner = "";
  const errors: string[] = [];
  const dateKey = practiceDatesFrom(new Date());
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
          // This prior practice has irons only; a Driver report must not broaden on navigation.
          if (daysAgo === 2 && club.type === "driver") continue;
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
        baseURL,
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
        if (surface === "workbench") {
          await expect(report.getByRole("heading", { level: 2 })).toContainText("Driver");
          await expect(report).toHaveAttribute("data-progress-verdict", "building");
          await expect(report).not.toContainText("7i");
          await expect(report).toContainText("0 of 0 trusted full shots");
          await report.locator(`a[href="/today?date=${dateKey(4)}&club=driver"]`).click();
          await expect(report.locator("time").first()).toHaveAttribute("datetime", dateKey(4));
          await expect(report.getByRole("heading", { level: 2 })).toContainText("Driver");
          await expect(report).not.toContainText("7i");
          await expect(report).toContainText("12 of 12 trusted full shots");
          await page.goto(`/today?date=${dateKey(3)}&club=driver`);
          await expect(report.getByRole("heading", { level: 2 })).toContainText("Driver");
          await expect(report).toHaveAttribute("data-progress-verdict", "building");
          await expect(report).toContainText("0 of 0 trusted full shots");
          await expect(
            report.locator(`a[href="/today?date=${dateKey(4)}&club=driver"]`),
          ).toBeVisible();
          await page.goto("/today?club=invalid-report-scope");
          await expect(report).not.toContainText("invalid-report-scope");
          await expect(report).toContainText("7i");
          await expect(report).toContainText("Driver");
          await expect(report.locator('a[href*="&club="]')).toHaveCount(0);
        }
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

test("Today keeps the latest completed practice after the calendar day changes", async ({
  browser,
}, info) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      !["http://localhost:3116", "http://localhost:3117"].includes(baseURL ?? ""),
    "Designated disposable fixture only",
  );
  test.skip(info.project.name !== "chromium", "Explicit desktop and mobile route coverage");
  test.setTimeout(240000);
  const db = postgres(value!, { max: 1 });
  const now = new Date();
  const dateKey = practiceDatesFrom(now);
  const latestShotIds: string[] = [];
  const errors: string[] = [];
  let owner = "";

  try {
    owner = (
      await db`insert into fkh_users(name) values('Today midnight isolated fixture') returning id`
    )[0].id;
    const [club] = await db`insert into fkh_clubs(user_id,type,brand,model,normalized_club_key)
      values(${owner},'7i','Fixture','Midnight iron','midnight-iron') returning id`;

    // This account has no measured practice today. Its latest complete practice was yesterday,
    // across two uploads; no browser-only clock override can change the server's date selection.
    for (const [practiceIndex, daysAgo] of [6, 3, 1].entries()) {
      const uploadCount = daysAgo === 1 ? 2 : 1;
      for (let upload = 0; upload < uploadCount; upload++) {
        const [session] =
          await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name)
          values(${owner},'rapsodo','range',${`${dateKey(daysAgo)}T12:00:00Z`},'Synthetic',${`Midnight practice ${daysAgo}-${upload}.csv`}) returning id`;
        for (let index = 0; index < 12 / uploadCount; index++) {
          const spread = [12, 8, 2][practiceIndex];
          const carry = [140, 148, 154][practiceIndex] + (index % 2 ? spread : -spread);
          const [shot] =
            await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,shot_number,
            carry_yd,total_yd,side_carry_yd,ball_speed_mph,launch_angle_deg,apex_ft,source_raw_json)
            values(${owner},${session.id},${club.id},${`${dateKey(daysAgo)}T12:00:00Z`},'7i',${index + 1},
            ${carry},${carry + 10},${[18, 12, 4][practiceIndex]},110,15,70,'{}') returning id`;
          if (daysAgo === 1) latestShotIds.push(shot.id);
        }
      }
    }

    // A newer round with a shot and an even newer empty range must not replace that practice.
    const [round] =
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name)
      values(${owner},'manual','round',${now.toISOString()},'Synthetic','Midnight round distractor') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,shot_at,club_type,carry_yd,side_carry_yd,source_raw_json)
      values(${owner},${round.id},${club.id},${now.toISOString()},'7i',190,40,'{}')`;
    await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name)
      values(${owner},'rapsodo','range',${new Date(now.getTime() + 1).toISOString()},'Synthetic','Midnight empty range')`;

    const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");
    const token = [encode({ alg: "none" }), encode({ sub: owner }), "playwright"].join(".");
    for (const surface of ["workbench", "companion"]) {
      const context = await browser.newContext({
        baseURL,
        timezoneId: "Europe/London",
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
        await expect(report.locator("time").first()).toHaveAttribute("datetime", dateKey(1));
        await expect(report).toHaveAttribute("data-progress-verdict", "better");
        await expect(report.locator(`a[href="/today?date=${dateKey(3)}"]`)).toBeVisible();
        await expect(report).toContainText("12 of 12 trusted full shots");
        await expect(page.getByText("Practice complete · Today", { exact: true })).toHaveCount(0);

        if (surface === "companion") {
          const review = page.locator("[data-today-practice-review]");
          await expect(review).toBeVisible({ timeout: 60000 });
          await expect(review.getByLabel("Practice totals")).toContainText("12");
          await expect(
            review.locator('[data-mobile-dispersion-layout] circle[role="button"]'),
          ).toHaveCount(12, { timeout: 60000 });
          await expect(page.locator("[data-today-primary-action]")).toHaveAttribute(
            "href",
            "#today-practice-review",
          );
        } else {
          const points = page.locator("[data-today-shot-point]");
          await expect(points).toHaveCount(12, { timeout: 60000 });
          const plottedIds = await points.evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-today-shot-point")),
          );
          expect([...plottedIds].sort()).toEqual([...latestShotIds].sort());
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
        await page.screenshot({ path: info.outputPath(`today-after-midnight-${surface}.png`) });

        const nextPractice = page.getByRole("link", { name: "Next practice", exact: true });
        await expect(nextPractice).toBeVisible();
        await expect(nextPractice).toHaveAttribute("href", "/practice");
        await nextPractice.click();
        await expect(page).toHaveURL((url) => url.pathname === "/practice", { timeout: 60000 });

        // An explicit empty date remains an intentional empty review; it must not borrow yesterday.
        await page.goto(`/today?date=${dateKey(0)}`);
        await expect(page.locator("[data-today-workspace-tabs]")).toHaveAttribute(
          "data-ready",
          "true",
          { timeout: 60000 },
        );
        await expect(page).toHaveURL((url) => url.searchParams.get("date") === dateKey(0));
        await expect(report).toHaveCount(0);
        await expect(page.locator("[data-today-practice-review]")).toHaveCount(0);
        await expect(page.locator("[data-today-shot-point]")).toHaveCount(0);
        await expect(page.locator("[data-mobile-shot-pattern]")).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Next practice", exact: true }),
        ).toHaveAttribute("href", "/practice");
        await page.screenshot({ path: info.outputPath(`today-explicit-empty-${surface}.png`) });
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

function practiceDatesFrom(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
  const today = formatter.format(now);
  return (daysAgo: number) => {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - daysAgo);
    return formatter.format(day);
  };
}
