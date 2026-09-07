import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Play preserves setup, complete planning details and active round priority", async ({
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
      await db`insert into fkh_sessions(user_id,source,type,date,course_id,tee_set_id,course_name,scorecard_json,raw_csv_text) values(${owner!},'manual','real_round','2026-09-02',${course.id},${tee.id},'Synthetic exact course round',${db.json(scorecard)},'unchanged course round') returning id`;
    for (let h = 1; h <= 2; h++)
      await db`insert into fkh_holes(course_id,tee_set_id,hole_number,par,yards,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson) select ${course.id},${tee.id},${h},4,300,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson from fkh_holes limit 1`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) select user_id,${round.id},club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,'2026-09-02',source_raw_json from fkh_shots where session_id=${session.id}`;
    const original =
      await db`select id,carry_yd,total_yd,side_carry_yd,source_raw_json from fkh_shots where session_id=${round.id} order by id`;
    await db`update fkh_sessions set round_status='complete' where id=${round.id}`;
    for (const surface of ["workbench", "companion"]) {
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
          `/surface/${surface}?next=${encodeURIComponent(`/play?courseId=${course.id}&teeSetId=${tee.id}`)}`,
        );
        await expect(
          page.getByRole("link", {
            name: surface === "companion" ? "Prepare Course" : "Open Strategy",
            exact: true,
          }),
        ).toHaveAttribute("href", `/courses/strategy?courseId=${course.id}&teeSetId=${tee.id}`);
        await expect(page.getByRole("link", { name: "Start Round", exact: true })).toHaveAttribute(
          "href",
          `/rounds/new?courseId=${course.id}&teeSetId=${tee.id}`,
        );
        await page.getByRole("button", { name: "Change course or tee", exact: true }).click();
        const drawer = page.getByRole("dialog");
        await drawer
          .getByRole("searchbox", { name: "Search courses", exact: true })
          .fill("Synthetic");
        await drawer.getByRole("searchbox", { name: "Search tees", exact: true }).fill("exact");
        await drawer.getByRole("button", { name: "Reset setup", exact: true }).click();
        await expect(
          drawer.getByRole("searchbox", { name: "Search tees", exact: true }),
        ).toHaveValue("");
        await drawer.getByRole("button", { name: "Apply setup", exact: true }).click();
        await expect(
          drawer.getByRole("button", { name: "Apply setup", exact: true }),
        ).toBeEnabled();
        await drawer
          .getByRole("button", { name: "Done / cancel unsaved setup", exact: true })
          .click();
        if (surface === "companion") {
          await page.locator("summary").filter({ hasText: "Your preparation checklist" }).click();
          await page.locator("summary").filter({ hasText: "Longest mapped decisions" }).click();
          await page.locator("summary").filter({ hasText: "Trusted clubs" }).click();
          await expect(
            page.getByText("No qualified hole recommendations yet.", { exact: true }),
          ).toBeVisible();
        }
        await expect(
          page.getByRole("list", { name: "Course preparation status" }).last(),
        ).toContainText("2 mapped holes for the selected tee");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P53-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await db`update fkh_sessions set round_status='in_progress' where id=${round.id}`;
        await page.reload();
        await expect(
          page.getByRole("link", { name: "Continue Round", exact: true }),
        ).toHaveAttribute("href", `/rounds/${round.id}`);
        await expect(
          page.getByRole("button", { name: "Change course or tee", exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Start Round", exact: true })).toHaveCount(0);
        await db`update fkh_sessions set round_status='complete' where id=${round.id}`;
      }
    }
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,source_raw_json from fkh_shots where session_id=${round.id} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
