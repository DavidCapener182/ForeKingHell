import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Goal improvement projects save owned baseline and practice links on both surfaces", async ({
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
  page.on("pageerror", (error) => console.log("PAGE ERROR", error.message));
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
    let original =
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
    const goal = {
      id: "ui-project-goal",
      type: "carry",
      title: "Synthetic carry target",
      club: "7i",
      startingValue: 140,
      currentValue: 150,
      targetValue: 160,
      unit: "yd",
      targetDate: "2026-12-31",
      evidenceSource: "Fixture",
      nextAction: "Measure practice",
    };
    await db`insert into fkh_user_feature_preferences(user_id,highlight_settings_json) values(${owner!},${db.json({ goals: [goal] })})`;
    const [plan] =
      await db`insert into fkh_practice_plans(user_id,source_session_id,session_type,ball_count,time_minutes,energy_level,intent,focus_clubs_json,title,generated_summary,status,planned_at) values(${owner!},${session.id},'range',3,10,'normal','confidence','["7i"]'::jsonb,'Synthetic project practice','Fixture','planned','2026-09-02') returning id`;
    await db`insert into fkh_practice_blocks(practice_plan_id,user_id,block_order,block_type,title,clubs_json,ball_count,time_minutes,goal,drill,success_criteria,record_prompt) values(${plan.id},${owner!},1,'technical','Synthetic iron drill','["7i"]'::jsonb,3,10,'Start line','Hit measured iron shots','Repeat start line','Record evidence')`;
    let linked = false;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=/goals`);
      const project = page.getByRole("region", { name: "Goal improvement projects" });
      await expect(project).toBeVisible({ timeout: 60000 });
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        const details = project
          .locator("details")
          .filter({ has: page.getByText("Edit baseline and practice links", { exact: true }) });
        if (!(await details.getAttribute("open"))) {
          if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open)))
            await project.getByText("Edit baseline and practice links", { exact: true }).click();
        }
        await project
          .getByRole("combobox", { name: "Baseline session", exact: true })
          .selectOption(session.id);
        await project.getByRole("checkbox", { name: /Synthetic project practice/ }).check();
        if (!linked) {
          await project.getByRole("button", { name: "Save project links", exact: true }).click();
          await expect(
            project.getByRole("link", { name: /Impact synthetic session/ }),
          ).toBeVisible();
          linked = true;
        }
        const planDetails = project
          .locator("summary")
          .filter({ hasText: "Synthetic project practice" });
        if (
          !(await planDetails.locator("..").evaluate((node) => (node as HTMLDetailsElement).open))
        )
          await planDetails.click();
        await expect(project.getByText("Synthetic iron drill", { exact: true })).toBeVisible();
        await expect(
          project.getByText("No qualifying subsequent measured evidence yet.", { exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P33-project-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    const [prefs] =
      await db`select highlight_settings_json from fkh_user_feature_preferences where user_id=${owner!}`;
    expect(prefs.highlight_settings_json.goals[0].project).toEqual({
      baselineSessionId: session.id,
      practicePlanIds: [plan.id],
    });
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
