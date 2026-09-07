import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Shot pattern exposes full mobile setup and selected projection scope", async ({
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
      await db`insert into fkh_courses(name,provider,visibility,created_by_user_id) values('Synthetic measured pattern course','manual','private',${owner!}) returning id`;
    const [tee] =
      await db`insert into fkh_tee_sets(course_id,name,par) values(${course.id},'Synthetic pattern tee',36) returning id`;
    for (let h = 1; h <= 2; h++)
      await db`insert into fkh_holes(course_id,tee_set_id,hole_number,par,yards,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson) select ${course.id},${tee.id},${h},4,300,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson from fkh_holes limit 1`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent(`/courses/${course.id}/shot-pattern`)}`,
      );
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        if (width < 1024) await page.locator("[data-mobile-shot-pattern-trigger]").click();
        const controls = page.locator("[data-mobile-shot-pattern-controls]");
        await controls.getByRole("button", { name: "2", exact: true }).click();

        await controls
          .getByRole("spinbutton", { name: "Playing length yards", exact: true })
          .fill("330");
        const parent =
          width < 1024
            ? page.getByRole("dialog")
            : page.locator('[data-responsive-detail-panel="inline"]');
        await parent.getByRole("button", { name: "Apply setup", exact: true }).click();
        if (width < 1024) await expect(page.getByRole("dialog")).toBeHidden();
        await expect(page.getByText(/Projection from your measured shots/)).toBeVisible();
        await expect(page.getByRole("img", { name: "Shot pattern course view", exact: true })).toContainText("Hole 2");
        await page.locator("summary").filter({ hasText: "Hole and club evidence" }).click();
        await expect(
          page.getByRole("heading", { name: "Shot-pattern setup board", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P50-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await page.locator("summary").filter({ hasText: "Hole and club evidence" }).click();
        if (width < 1024) {
          await page.locator("[data-mobile-shot-pattern-trigger]").click();
          await controls.getByRole("button", { name: "1", exact: true }).click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: /^Close/ })
            .click();
          await expect(page.locator("[data-mobile-shot-pattern-trigger]")).toContainText("Hole 2");
        }
      }
    }
    expect(
      (await db`select raw_csv_text from fkh_sessions where id=${session.id}`)[0].raw_csv_text,
    ).toBe("synthetic");
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
