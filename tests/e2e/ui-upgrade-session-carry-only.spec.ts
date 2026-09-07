import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Carry-only session retains151yd carry and missing direction on both surfaces", async ({
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
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] = await db`insert into fkh_users(name) values('UI impact isolated') returning id`;
    owner = user.id;
    const [session] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'rapsodo','range','2026-09-01','Carry-only synthetic session','synthetic') returning id`;
    const [club] =
      await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},'7i','ui-impact-7i') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) values(${owner!},${session.id},${club.id},'7i',1,150,null,null,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',2,152,null,null,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',3,999,null,null,'good','stock','user_excluded','2026-09-01','{}'::jsonb)`;
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
        await page.goto(`/sessions/${session.id}`);
        await check(
          page.getByRole("heading", {
            level: 1,
            name: "Carry-only synthetic session",
            exact: true,
          }),
        ).toBeVisible();
        if (surface === "workbench") {
          const numbers = page.getByRole("region", { name: "Four important session numbers" });
          const carry = numbers
            .locator(":scope > div")
            .filter({ has: page.getByText("Median carry", { exact: true }) });
          await expect(carry).toContainText("151 yd");
          await expect(page.getByRole("region", { name: "Club summary" })).toContainText("151 yd");
          await expect(
            page.getByText("No trusted landing pattern is available for this selection.", {
              exact: true,
            }),
          ).toBeVisible();
          const offline = numbers
            .locator(":scope > div")
            .filter({ has: page.getByText("Average offline", { exact: true }) });
          await expect(offline).toContainText("—");
        } else {
          await check(page.locator("[data-url-tabs]")).toHaveAttribute("data-ready", "true");
          await page.getByRole("tab", { name: "Clubs & shots", exact: true }).click();
          const story = page.getByRole("region", { name: "Session metric story" });
          await check(story).toContainText("151");
          await expect(story).toContainText("yd");
          await expect(story).not.toContainText("offline");
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: info.outputPath(`P05-carry-only-${surface}-${width}.png`),
            fullPage: true,
          });
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
