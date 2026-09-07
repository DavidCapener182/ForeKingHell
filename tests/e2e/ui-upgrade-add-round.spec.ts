import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Add round keeps searchable setup and explicitly resets incompatible tees", async ({
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
    const [privateCourse] =
      await db`insert into fkh_courses(name,visibility,created_by_user_id) values('Synthetic second setup course','private',${owner!}) returning id`;
    const [privateTee] =
      await db`insert into fkh_tee_sets(course_id,name,par) values(${privateCourse.id},'Synthetic tee',36) returning id`;
    for (let hole = 1; hole <= 9; hole++)
      await db`insert into fkh_holes(course_id,tee_set_id,hole_number,par,yards,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson) select ${privateCourse.id},${privateTee.id},${hole},par,yards,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson from fkh_holes limit 1`;
    const options =
      await db`select distinct on(c.id) c.id as course_id,c.name as course_name,t.id as tee_id from fkh_courses c join fkh_tee_sets t on t.course_id=c.id where (c.visibility='shared' or c.created_by_user_id=${owner!}) and exists(select 1 from fkh_holes h where h.tee_set_id=t.id) order by c.id,t.id`;
    expect(options.length).toBeGreaterThan(1);
    const [first, second] = options;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent(`/rounds/new?courseId=${first.course_id}&teeSetId=${first.tee_id}`)}`,
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
        if (surface === "companion") {
          await page
            .getByRole("combobox", { name: "Course", exact: true })
            .selectOption(second.course_id);
          await expect(page.getByRole("combobox", { name: "Tee", exact: true })).toHaveValue("");
          await expect(
            page.getByRole("button", { name: "Start round", exact: true }),
          ).toBeDisabled();
          await expect(page.getByRole("status")).toContainText("Course changed");
          await page
            .getByRole("combobox", { name: "Tee", exact: true })
            .selectOption(second.tee_id);
          await expect(
            page.getByRole("button", { name: "Start round", exact: true }),
          ).toBeEnabled();
          await page
            .getByRole("combobox", { name: "Course", exact: true })
            .selectOption(first.course_id);
          await page.getByRole("combobox", { name: "Tee", exact: true }).selectOption(first.tee_id);
        } else {
          await page
            .getByRole("searchbox", { name: "Search courses and tees", exact: true })
            .fill("No matching course xyz");
          await expect(
            page.getByRole("combobox", { name: "Course / tee", exact: true }),
          ).toHaveValue(first.tee_id);
          await page
            .getByRole("searchbox", { name: "Search courses and tees", exact: true })
            .fill("");
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P44-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
