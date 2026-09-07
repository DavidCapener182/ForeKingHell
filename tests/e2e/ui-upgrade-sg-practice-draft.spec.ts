import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Strokes gained saves exact scoped category drills without judging missing outcomes", async ({
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
  test.setTimeout(300000);
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] =
      await db`insert into fkh_users(name) values('UI SG draft isolated') returning id`;
    owner = user.id;
    const [session] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'rapsodo','range','2026-09-01','Impact synthetic session','synthetic') returning id`;
    const [club] =
      await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},'7i','ui-impact-7i') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) values(${owner!},${session.id},${club.id},'7i',1,150,160,-3,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',2,155,165,4,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',3,160,170,7,'good','stock','included','2026-09-01','{}'::jsonb)`;
    const original =
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
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
    await db`update fkh_sessions set type='round',course_name='Synthetic SG course' where id=${session.id}`;
    await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,start_distance_yd,end_distance_yd,hole_number,stroke_number,strokes_gained) values (${owner!},${session.id},'tee','tee','fairway',400,150,1,1,1),(${owner!},${session.id},'approach','fairway','green',150,5,1,2,-2),(${owner!},${session.id},'putting','green','holed',5,0,1,3,null)`;
    await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,start_distance_yd,end_distance_yd,hole_number,stroke_number,strokes_gained) values (${owner!},${session.id},'short_game','rough','green',20,2,2,3,-0.4)`;
    const sourceEvents =
      await db`select id,category,strokes_gained from fkh_strokes_gained_shot_events where user_id=${owner!} order by id`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const check = expect.configure({ timeout: 60000 });
    const categories = ["tee", "approach", "short_game", "putting"];
    const scenarios = [
      ...[1440, 390].flatMap((width) =>
        categories.map((category) => ({ width, height: width === 1440 ? 900 : 844, category })),
      ),
      ...[
        { width: 1280, height: 800 },
        { width: 360, height: 800 },
        { width: 1023, height: 800 },
        { width: 1024, height: 800 },
      ].map((size) => ({ ...size, category: "putting" })),
    ].filter(
      ({ width, category }) =>
        process.env.PLAYWRIGHT_FOCUSED_CONFIDENCE !== "1" ||
        (category === "putting" && [1440, 390].includes(width)),
    );
    for (const surface of ["workbench", "companion"]) {
      await context.addCookies([
        { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
      ]);
      for (const { width, height, category } of scenarios) {
        await page.setViewportSize({ width, height });
        await page.goto(`/strokes-gained?category=${category}&sessionId=${session.id}`);
        const card = page.locator("#sg-practice-priority");
        const button = card.getByRole("button", {
          name: "Save this drill as a practice draft",
          exact: true,
        });
        await check(button).toBeVisible();
        const form = button.locator("..");
        const creationId = await form.locator('input[name="creationId"]').inputValue();
        const displayedDrill = await card.locator("p").first().innerText();
        await button.click();
        await check(page).toHaveURL(new RegExp(`/practice\\?planId=${creationId}`));
        await check(
          page.getByRole("heading", {
            name: surface === "companion" ? "Practice" : "Practice Planner",
            exact: true,
          }),
        ).toBeVisible();
        const [saved] =
          await db`select status,started_at,facility_json from fkh_practice_plans where id=${creationId} and user_id=${owner!}`;
        expect(saved.facility_json.generation.prescriptionConfidence).toBe("Low");
        expect(saved.status).toBe("planned");
        expect(saved.started_at).toBeNull();
        expect(saved.facility_json.generation.sgHandoff.category).toBe(category);
        expect(saved.facility_json.generation.sgHandoff.sessionIds).toEqual([session.id]);
        if (category === "putting")
          expect(saved.facility_json.generation.sgHandoff).toMatchObject({
            total: null,
            sampleSize: 0,
            pendingCount: 1,
          });
        const [block] =
          await db`select drill,success_criteria,scoring_rules_json from fkh_practice_blocks where practice_plan_id=${creationId}`;
        expect(block.drill).toBe(displayedDrill);
        expect(block.scoring_rules_json.evidenceMode).toBe("manual");
        await check(page.getByText(block.drill, { exact: true }).last()).toBeVisible();
        await check(
          page.getByRole("complementary", { name: "Strokes-gained practice source" }),
        ).toContainText("Completing it does not prove a measured improvement");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`sg-practice-${surface}-${category}-${width}.png`),
          animations: "disabled",
        });
        await page.reload();
        await check(page.getByText(block.drill, { exact: true }).last()).toBeVisible();
        await check(
          page.getByRole("complementary", { name: "Strokes-gained practice source" }),
        ).toBeVisible();
        await check(
          page.getByText(surface === "companion" ? "Low confidence" : "Low plan confidence", {
            exact: true,
          }),
        ).toBeVisible();
      }
    }
    expect(errors).toEqual([]);
    expect(
      await db`select id,category,strokes_gained from fkh_strokes_gained_shot_events where user_id=${owner!} order by id`,
    ).toEqual(sourceEvents);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
