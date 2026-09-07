import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Performance Lab exposes measured evidence and read-only models on both surfaces", async ({
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
    const [indoor] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'rapsodo','simulator','2026-09-01','Synthetic indoor latest','synthetic') returning id`;
    const [baseline] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'rapsodo','simulator','2026-08-15','Synthetic indoor baseline','synthetic') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) select user_id,${indoor.id},club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json from fkh_shots where session_id=${session.id}`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) select user_id,${baseline.id},club_id,club_type,shot_number,carry_yd-5,total_yd-5,side_carry_yd,quality_tag,shot_category,review_status,'2026-08-15',source_raw_json from fkh_shots where user_id=${owner!}`;
    await db`update fkh_shots set play_context='indoor',side_carry_yd=40 where user_id=${owner!}`;
    original =
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
    let requests = 0;
    await page.route("**/api/ai/session-roast", async (route) => {
      requests++;
      await route.fulfill({
        status: requests === 1 ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          requests === 1
            ? { message: "Synthetic generation unavailable" }
            : {
                roast: {
                  headline: "Synthetic private banter",
                  roast: "Fixture response for UI verification.",
                  shortCaption: "Synthetic",
                  safetyNote: "Humour only, not coaching advice.",
                },
              },
        ),
      });
    });
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=/simulator-lab`);
      await expect(page.locator('[data-url-tabs][data-ready="true"]')).toBeVisible({
        timeout: 60000,
      });
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.getByRole("tab", { name: "Analysis", exact: true }).click();
        await expect(page.getByText("Unofficial range estimate", { exact: true })).toBeVisible();
        const shotSearch = page.getByRole("textbox", { name: "Search plotted shots", exact: true });
        await shotSearch.fill("unmatched shot");
        await expect(page.getByText("No matching records.", { exact: true })).toBeVisible();
        await shotSearch.fill("");
        await page
          .getByRole("button", { name: /7.*shot 1.*carry/ })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toContainText("Side carry (signed)");
        await page.getByRole("button", { name: "Close details", exact: true }).click();
        const input = page.getByRole("spinbutton", { name: /improvement percent/ }).first();
        if (await input.count()) {
          await input.fill("30");
          await expect(input).toHaveValue("30");
          await page.getByRole("button", { name: "Reset assumptions", exact: true }).click();
          await expect(input).toHaveValue("15");
        }
        await page.getByRole("tab", { name: "Gapping", exact: true }).click();
        await page.getByRole("button", { name: /Selected club/ }).click();
        await expect(page.getByRole("dialog")).toContainText("indoor gapping evidence");
        await page.getByRole("button", { name: "Close club search", exact: true }).click();
        await page.getByRole("tab", { name: "Session & setup", exact: true }).click();
        await page
          .getByRole("textbox", { name: "Search session comparisons", exact: true })
          .fill("");
        await page
          .getByRole("button", { name: /latest \/ .*baseline shots/ })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toContainText("Latest carry");
        await expect(page.getByRole("dialog")).toContainText("Baseline carry");
        await page.getByRole("button", { name: "Close details", exact: true }).click();
        await page.getByRole("tab", { name: "Optional banter", exact: true }).click();
        const roast = page.getByRole("button", { name: "Roast draft", exact: true });
        if ((await roast.getAttribute("aria-expanded")) === "false") await roast.click();
        await page.getByRole("button", { name: "Roast this session", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Nothing is published");
        await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("tab", { name: "Analysis", exact: true }).click();
        await expect(page.locator("h1:visible")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P29-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await page.getByRole("tab", { name: "Optional banter", exact: true }).click();
    await page.getByRole("button", { name: "Roast this session", exact: true }).click();
    await page.getByRole("button", { name: "Generate private banter", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Synthetic generation unavailable");
    await page.getByRole("button", { name: "Generate private banter", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Synthetic private banter", exact: true }),
    ).toBeVisible();
    expect(requests).toBe(2);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
