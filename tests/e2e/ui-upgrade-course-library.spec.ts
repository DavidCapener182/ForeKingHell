import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Course library retains search and applies draft filters on both surfaces", async ({
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
      await db`insert into fkh_courses(name,visibility,created_by_user_id) values('Synthetic course library long identity and location review','private',${owner!}) returning id`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=${encodeURIComponent("/courses")}`);
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        const library = page.locator("[data-course-library]");
        const search = library.getByRole("textbox", { name: "Search courses", exact: true });
        await search.fill("Synthetic course library");
        await expect(
          library.getByText("Synthetic course library long identity and location review", {
            exact: true,
          }),
        ).toBeVisible();
        await expect(page).toHaveURL(/q=Synthetic/);
        await library.getByRole("button", { name: /^Filters/ }).click();
        const drawer = page.getByRole("dialog");
        await drawer.getByRole("button", { name: "Played", exact: true }).click();
        await drawer.getByRole("button", { name: "Reset filters", exact: true }).click();
        await drawer.getByRole("button", { name: "Apply filters", exact: true }).click();
        await expect(drawer).toBeHidden();
        await expect(
          library.getByText("Synthetic course library long identity and location review", {
            exact: true,
          }),
        ).toBeVisible();
        await library.getByRole("button", { name: /^Filters/ }).click();
        await drawer.getByRole("button", { name: "Played", exact: true }).click();
        await drawer.getByRole("button", { name: "Apply filters", exact: true }).click();
        await expect(drawer).toBeHidden();
        await expect(
          library.getByText("No courses match this view", { exact: true }),
        ).toBeVisible();
        await library.getByRole("button", { name: "Clear all", exact: true }).click();
        await search.fill("Synthetic course library");
        expect(await library.locator(`a[href*="${course.id}"]`).count()).toBeGreaterThan(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P46-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.reload();
      await expect(
        page
          .locator("[data-course-library]")
          .getByRole("textbox", { name: "Search courses", exact: true }),
      ).toHaveValue("Synthetic course library");
    }
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
