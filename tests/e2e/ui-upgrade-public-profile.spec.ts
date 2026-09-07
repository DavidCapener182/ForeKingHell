import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Public profile keeps scoped activity, complete bag facts and exact relationship actions", async ({
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
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  const db = postgres(value!, { max: 1 });
  const users: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const viewer = (
      await db`insert into fkh_users(name) values('Synthetic public viewer') returning id`
    )[0].id;
    users.push(viewer);
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: viewer, email: "publicprofile@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        const player = (
          await db`insert into fkh_users(name) values('Synthetic viewed golfer') returning id`
        )[0].id;
        users.push(player);
        const username = `public-${player.slice(0, 8)}`;
        const name = `Synthetic golfer with a complete long identity ${width}`;
        await db`insert into fkh_user_profiles(user_id,username,display_name,public_profile,friend_profile,handicap_band,visibility_settings_json) values(${player},${username},${name},true,true,'Secret handicap',${db.json({ bag: "friends", rounds: "private", handicap: "private", pbs: "private" })})`;
        const club = (
          await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${player},'7 Iron','synthetic-public-7i') returning id`
        )[0].id;
        await db`insert into fkh_stock_yardages(user_id,club_id,sample_size,carry_median_yd,total_median_yd,confidence_score) values(${player},${club},10,150,160,80)`;
        await db`insert into fkh_feed_items(user_id,item_type,headline,visibility) values(${player},'new_pb','Private category secret','public'),(${player},'status_update','Allowed public update','public')`;
        const request = (
          await db`insert into fkh_friend_requests(requester_user_id,recipient_user_id) values(${player},${viewer}) returning id`
        )[0].id;
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/profile/" + username)}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible({
          timeout: 60000,
        });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        await expect(
          page.getByText("Allowed public update", { exact: true }).first(),
        ).toBeVisible();
        await expect(page.getByText("Private category secret", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Secret handicap", { exact: true })).toHaveCount(0);
        await expect(
          page.getByRole("status").filter({ hasText: "No bag distances shared or available" }),
        ).toBeVisible();
        const act = async (label: string) => {
          await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
          await page.getByRole("menuitem", { name: label, exact: true }).click();
        };
        await act("Accept request");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText(name);
        await dialog.getByRole("button", { name: "Keep current state", exact: true }).click();
        expect(
          (await db`select status from fkh_friend_requests where id=${request}`)[0].status,
        ).toBe("pending");
        await act("Accept request");
        await dialog.getByRole("button", { name: "Confirm: Accept request", exact: true }).click();
        await expect(dialog).toHaveCount(0, { timeout: 60000 });
        await expect
          .poll(
            async () =>
              (await db`select status from fkh_friend_requests where id=${request}`)[0].status,
          )
          .toBe("accepted");
        await expect(
          page.getByRole("status").filter({ hasText: "No bag distances shared or available" }),
        ).toHaveCount(0);
        const search = page.getByRole("textbox", { name: "Search visible clubs", exact: true });
        await search.fill("No club matches");
        await expect(
          page.getByRole("status").filter({ hasText: "No visible clubs match" }),
        ).toBeVisible();
        await search.fill("");
        if (width < 768) {
          await page.locator("summary").filter({ hasText: "150 yd carry" }).click();
          await expect(page.getByText("160 yd", { exact: true })).toBeVisible();
          await expect(page.getByText("80%", { exact: true })).toBeVisible();
        } else {
          await expect(
            page.locator('[data-workbench-export-table="profile-bag-comparison"]'),
          ).toContainText("150");
        }
        await expect(page.getByText("Private category secret", { exact: true })).toHaveCount(0);
        await act("Block golfer");
        await expect(dialog).toContainText(name);
        await dialog.getByRole("button", { name: "Keep current state", exact: true }).click();
        expect(
          (
            await db`select id from fkh_user_blocks where blocker_user_id=${viewer} and blocked_user_id=${player}`
          ).length,
        ).toBe(0);
        await expect(dialog).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0));
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P70-${surface}-${width}.png`) });
      }
    expect(errors).toEqual([]);
  } finally {
    if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
    await db.end();
  }
});
