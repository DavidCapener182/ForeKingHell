import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Assigned player workspace preserves scope through search, details and draft fields", async ({
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
    "Designated disposable fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  const db = postgres(value!, { max: 1 });
  const ids: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const people =
      await db`insert into fkh_users(name) values('UI coach'),('UI player Alpha'),('UI player Beta') returning id,name`;
    ids.push(...people.map((person) => person.id));
    const coach = people[0].id;
    const alpha = people[1].id;
    const beta = people[2].id;
    await db`insert into fkh_account_memberships(owner_user_id,member_user_id,role) values(${alpha},${coach},'coach'),(${beta},${coach},'coach')`;
    await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${alpha},'manual','range','2026-09-01','Alpha source','synthetic'),(${beta},'manual','range','2026-09-02','Beta source','synthetic')`;
    await db`insert into fkh_coach_player_interactions(player_user_id,coach_user_id,interaction_type,visibility,title,body) values(${alpha},${coach},'private_note','coach_only','Private Alpha note','Synthetic coach-only note'),(${beta},${coach},'practice_assignment','player_visible','Beta assignment','Synthetic visible assignment')`;
    const encode = (item: unknown) => Buffer.from(JSON.stringify(item)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: coach, email: "ui-coach@forekinghell.local" }),
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
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent(`/coach/workspace?playerId=${alpha}`)}`,
      );
      await expect(page.getByRole("heading", { name: "Coach workspace", exact: true })).toBeVisible(
        { timeout: 60000 },
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
        await page.getByRole("button", { name: "Search assigned players", exact: true }).click();
        await page.getByRole("textbox", { name: "Search players", exact: true }).fill("Beta");
        await page.getByRole("link", { name: /UI player Beta/ }).click();
        await expect(
          page.getByText("Selected player: UI player Beta", { exact: true }),
        ).toBeVisible();
        await expect(page.getByText("Private Alpha note", { exact: true })).not.toBeVisible();
        await page.getByRole("button", { name: "Inspect Beta source", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Selected player: UI player Beta");
        await page.getByRole("button", { name: "Close details", exact: true }).click();
        await page
          .getByRole("textbox", { name: "Title", exact: true })
          .fill("Synthetic unsaved assignment");
        await page
          .getByRole("textbox", { name: "Detail", exact: true })
          .fill("Keep this private test draft until cancel.");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
        await expect(page.locator("h1")).toHaveCount(1);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P20-${surface}-${width}.png`) });
      }
    }
    await page.goto("/coach/workspace?playerId=00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Requested player unavailable", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (ids.length) await db`delete from fkh_users where id in ${db(ids)}`;
    await db.end();
  }
});
