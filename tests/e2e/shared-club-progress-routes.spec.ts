import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("shared progress on real fixture routes: both Today surfaces and Dashboard", async ({
  browser,
}, info) => {
  const url = process.env.DATABASE_URL;
  const target = url ? new URL(url) : null;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      baseURL !== "http://localhost:3116",
    "Exact designated disposable fixture only",
  );
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix");
  test.setTimeout(240000);
  const db = postgres(url!, { max: 1 });
  let owner = "";
  const errors: string[] = [];
  try {
    owner = (
      await db`insert into fkh_users(name) values('Shared progress browser fixture') returning id`
    )[0].id;
    const equipment =
      await db`insert into fkh_clubs(user_id,type,brand,model,normalized_club_key,active) values(${owner},'driver','Fixture','Driver','shared-browser-driver',true),(${owner},'7i','Fixture','Iron','shared-browser-iron',true),(${owner},'6i','Fixture','Retired','shared-browser-retired',false) returning id,type`;
    let latest = "";
    for (let day = 1; day <= 22; day++) {
      const timestamp = `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`;
      const [s] =
        await db`insert into fkh_sessions(user_id,source,type,play_context,date,file_name,raw_csv_text) values(${owner},'rapsodo','range','outdoor',${timestamp},${`Shared browser ${day}.csv`},'Synthetic fixture') returning id`;
      latest = s.id;
      for (const club of equipment) {
        if (day === 22 && club.type !== "driver") continue;
        await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,play_context,shot_category,carry_yd,total_yd,side_carry_yd,ball_speed_mph,club_speed_mph,smash_factor,launch_angle_deg,apex_ft,source_raw_json)
     select ${owner},${s.id},${club.id},${club.type},${timestamp}::timestamptz,x,'outdoor','full',${day === 21 ? null : 150 + day},${day === 21 ? null : 165 + day},case when x%2=0 then -10 else 10 end,${110 + day},${80 + day},1.4,15,60,'{}'::jsonb from generate_series(1,12) as x`;
      }
    }
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [encode({ alg: "none" }), encode({ sub: owner }), "playwright"].join(".");
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      hasTouch: true,
    });
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      for (const [surface, width, route] of [
        ["workbench", 1440, "today"],
        ["companion", 390, "today"],
        ["companion", 320, "today"],
        ["workbench", 1440, "dashboard"],
      ] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/surface/${surface}?next=%2F${route}%3FcpMetric%3DcarryYd`);
        const panel = page.locator("[data-club-progress]");
        await expect(panel).toBeVisible({ timeout: 60000 });
        await expect(panel).not.toContainText("Retired");
        await expect(page.locator("main h2").first()).toHaveText("Am I improving?");
        await expect(panel.locator("[data-progress-cards]")).toContainText(
          "Previous reading unavailable",
        );
        const requests: string[] = [];
        const onRequest = (r: import("@playwright/test").Request) => {
          if (r.isNavigationRequest() || r.url().includes("_rsc") || r.url().includes("/api/"))
            requests.push(r.url());
        };
        page.on("request", onRequest);
        await panel.getByRole("tab", { name: "Accuracy", exact: true }).click();
        await expect(panel.locator("[data-progress-cards]")).toContainText("10.0 yd");
        await panel.getByRole("button", { name: "Last 20", exact: true }).click();
        await expect(panel.getByLabel("Inspect session points").getByRole("button")).toHaveCount(
          20,
        );
        const cardBefore = await panel.locator("[data-progress-cards]").innerText();
        await panel.getByRole("checkbox", { name: "3-session rolling average" }).check();
        expect(await panel.locator("[data-progress-cards]").innerText()).toBe(cardBefore);
        await panel.getByLabel("Inspect session points").getByRole("button").first().tap();
        await expect(panel.locator("[data-inspected-session]")).not.toContainText("22 Sept 2026");
        expect(await panel.locator("[data-progress-cards]").innerText()).toBe(cardBefore);
        await panel.getByRole("tab", { name: "Ball speed", exact: true }).click();
        await page.goBack();
        await expect(panel.getByRole("tab", { name: "Accuracy", exact: true })).toHaveAttribute(
          "data-state",
          "active",
        );
        await page.goForward();
        await expect(panel.getByRole("tab", { name: "Ball speed", exact: true })).toHaveAttribute(
          "data-state",
          "active",
        );
        expect(requests).toEqual([]);
        page.off("request", onRequest);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`route-${surface}-${route}-${width}.png`),
          fullPage: true,
        });
        // Explicit URL metric wins over a saved preference and survives reload.
        await page.goto(`/${route}?cpMetric=carryYd`);
        await expect(panel.getByRole("tab", { name: "Carry", exact: true })).toHaveAttribute(
          "data-state",
          "active",
        );
        await page.goto(`/${route}`);
        await expect(panel.getByRole("tab", { name: "Ball speed", exact: true })).toHaveAttribute(
          "data-state",
          "active",
        );
        if (route === "dashboard") {
          await panel.getByRole("button", { name: "Irons", exact: true }).click();
          await expect(panel.getByRole("tab", { name: /7i/ })).toHaveAttribute(
            "data-state",
            "active",
          );
        }
      }
      await page.goto("/today?date=2026-08-01");
      await expect(page.locator("[data-club-progress]")).toContainText("No eligible full shots");
      await expect(page.locator("[data-progress-cards]")).toHaveCount(0);
      await page.goto(`/today?session=${latest}&club=driver`);
      await expect(page.locator("[data-club-progress]")).not.toContainText("7i");
      await page
        .locator("[data-club-progress]")
        .getByRole("tab", { name: "Ball speed", exact: true })
        .click();
      await expect(
        page.locator("[data-club-progress]").getByRole("tab", { name: "Ball speed", exact: true }),
      ).toHaveAttribute("data-state", "active");
      await expect(
        page.locator("[data-club-progress]").getByRole("link", { name: /Review source upload/ }),
      ).toHaveAttribute("href", `/sessions/${latest}`);
      await page
        .locator("[data-club-progress]")
        .getByRole("link", { name: /Review source upload/ })
        .click();
      await expect(page).toHaveURL(new RegExp(`/sessions/${latest}`), { timeout: 60000 });
      await expect(
        page.getByRole("heading", { name: "Shared browser 22.csv", exact: true }),
      ).toBeVisible({ timeout: 60000 });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
