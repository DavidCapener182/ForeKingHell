import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Coach saves the exact owned drill and target as an unstarted practice draft", async ({
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
  test.setTimeout(420000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] =
      await db`insert into fkh_users(name) values('UI Coach draft isolated') returning id`;
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
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
    const check = expect.configure({ timeout: 60000 });
    for (const surface of ["workbench", "companion"]) {
      await context.addCookies([
        { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
      ]);
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto("/coach");
        await page.getByRole("tab", { name: "Diagnosis", exact: true }).click();
        const button = page
          .getByRole("button", { name: "Save this drill as a practice draft", exact: true })
          .first();
        await check(button).toBeVisible();
        const form = button.locator("..");
        const creationId = await form.locator('input[name="creationId"]').inputValue();
        const clubId = await form.locator('input[name="clubId"]').inputValue();
        expect(clubId).toBe(club.id);
        const targetText = (await form.locator("..").locator("p").first().innerText()).replace(
          /^Target: /,
          "",
        );
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
        expect(saved.status).toBe("planned");
        expect(saved.started_at).toBeNull();
        expect(saved.facility_json.generation.coachHandoff.clubId).toBe(club.id);
        const [block] =
          await db`select drill,success_criteria,scoring_rules_json,clubs_json from fkh_practice_blocks where practice_plan_id=${creationId} and title like 'Main priority:%'`;
        expect(block.success_criteria).toBe(targetText);
        expect(block.clubs_json).toEqual(["7i"]);
        expect(block.scoring_rules_json.metric).toBe("coach_target");
        await check(page.getByRole("complementary", { name: "Coaching source" })).toBeVisible();
        if (surface === "companion")
          await page.getByRole("button", { name: "Show block 3", exact: true }).click();
        await check(page.getByText(block.drill, { exact: true }).first()).toBeVisible();
        if (surface === "companion") {
          await check
            .poll(async () =>
              page.locator("[data-practice-block-carousel]").evaluate((root) => {
                const viewport = root
                  .querySelector('[data-slot="carousel-content"]')!
                  .getBoundingClientRect();
                const selected = root
                  .querySelector('[aria-pressed="true"]')!
                  .getBoundingClientRect();
                return selected.left >= viewport.left - 1 && selected.right <= viewport.right + 1;
              }),
            )
            .toBe(true);
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (surface === "companion" && width === 360) {
          const selected = page.locator('[data-practice-block="2"]');
          await selected.focus();
          await selected.press("ArrowLeft");
          await check(page.locator('[data-practice-block="1"]')).toBeFocused();
          await page.locator('[data-practice-block="1"]').press("ArrowRight");
          await check(selected).toBeFocused();
          await check(selected).toHaveAttribute("aria-pressed", "true");
          await check(page.locator('[data-practice-block="0"]')).toHaveAttribute("tabindex", "-1");
        }
        await page.screenshot({
          path: info.outputPath(`coach-practice-${surface}-${width}.png`),
          animations: "disabled",
        });
        await page.reload();
        await check(page.getByRole("complementary", { name: "Coaching source" })).toBeVisible();
        if (surface === "companion")
          await page.getByRole("button", { name: "Show block 3", exact: true }).click();
        await check(page.getByText(block.drill, { exact: true }).first()).toBeVisible();
        if (surface === "companion") {
          await check
            .poll(async () =>
              page.locator("[data-practice-block-carousel]").evaluate((root) => {
                const viewport = root
                  .querySelector('[data-slot="carousel-content"]')!
                  .getBoundingClientRect();
                const selected = root
                  .querySelector('[aria-pressed="true"]')!
                  .getBoundingClientRect();
                return selected.left >= viewport.left - 1 && selected.right <= viewport.right + 1;
              }),
            )
            .toBe(true);
        }
      }
    }
    expect(errors).toEqual([]);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
