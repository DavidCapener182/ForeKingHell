import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Handicap keeps unofficial source estimates and full round calculations on both surfaces", async ({
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
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
    console.log("PAGE ERROR", error.stack);
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
    const cards = Array.from({ length: 9 }, (_, i) => ({
      hole: i + 1,
      par: 4,
      score: 5,
      putts: 2,
    }));
    for (let i = 0; i < 4; i++)
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,course_name,raw_csv_text,scorecard_json) values(${owner!},'manual','real_round',${`2026-09-0${i + 1}`},${`Synthetic round ${i + 1}`},${`Synthetic course ${i + 1}`},'',${db.json(cards)})`;
    await db`insert into fkh_sessions(user_id,source,type,date,file_name,course_name,raw_csv_text,scorecard_json) values(${owner!},'manual','real_round','2026-09-05','Incomplete synthetic round','Incomplete synthetic course','',${db.json(cards.slice(0, 4))})`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent("/handicap?filter=retained")}`,
      );
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
        await page.getByRole("tab", { name: "Round calculations", exact: true }).click();
        const tableDisclosure = page.locator("details").filter({
          has: page.locator("summary", { hasText: "Full differential table and export" }),
        });
        if ((await tableDisclosure.getAttribute("open")) === null)
          await tableDisclosure.locator("summary").click();
        await page.getByRole("button", { name: "Saved views", exact: true }).click();
        const suggested = page.getByRole("menuitem", { name: /Score differentials/ });
        await expect(suggested).toHaveAttribute("href", "/handicap?filter=retained&tab=rounds");
        await suggested.click();
        await expect(page).toHaveURL(/filter=retained&tab=rounds/);
        await expect(
          page.getByRole("tab", { name: "Round calculations", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        await page.getByRole("button", { name: /^Synthetic course 1 / }).click();
        await expect(page.getByRole("dialog")).toContainText("113 fallback");
        await expect(page.getByRole("dialog")).toContainText("18-hole equivalent");
        await page.getByRole("button", { name: "Close details", exact: true }).click();
        await page.getByRole("tab", { name: "Eligible-round trend", exact: true }).click();
        await expect(
          page.getByRole("textbox", { name: "Search trend points", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("textbox", { name: "Search trend points", exact: true })
          .fill("Incomplete synthetic");
        await expect(page.getByText("No matching records.", { exact: true })).toBeVisible();
        await page.getByRole("textbox", { name: "Search trend points", exact: true }).fill("");
        await page.getByRole("tab", { name: "Data to improve", exact: true }).click();
        await expect(page.getByRole("link", { name: /Synthetic course 1 Missing/ })).toBeVisible();
        await page.getByRole("tab", { name: "Estimates & methods", exact: true }).click();
        await expect(page.locator("h1:visible")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: info.outputPath(`P34-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
    expect(pageErrors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
