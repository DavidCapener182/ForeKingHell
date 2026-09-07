import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Friends preserve distinct states and confirmed relationship actions on both surfaces", async ({
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
  test.setTimeout(400000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const people: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.stack ?? error.message}`));
  try {
    const owner = (
      await db`insert into fkh_users(name) values('Synthetic friends owner') returning id`
    )[0].id;
    people.push(owner);
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              encode({ alg: "none" }),
              encode({ sub: owner, email: "friends@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:3116",
    });
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
          await db`insert into fkh_users(name) values('Synthetic friend target') returning id`
        )[0].id;
        people.push(player);
        const username = `fkh64-${player.slice(0, 8)}`;
        const name = `Synthetic golfer ${player.slice(0, 8)}`;
        await db`insert into fkh_user_profiles(user_id,username,display_name,public_profile,friend_profile) values(${player},${username},${name},true,true)`;
        const request = (
          await db`insert into fkh_friend_requests(requester_user_id,recipient_user_id) values(${player},${owner}) returning id`
        )[0].id;
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/friends?tab=incoming")}`);
        await expect(
          page.getByRole("heading", { name: "Friends", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        const tabs = page.getByRole("tablist", { name: "Friend sections" });
        await expect(tabs.getByRole("tab", { name: "Incoming (1)", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        const act = async (label: string) => {
          await page.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
          await page.getByRole("menuitem", { name: label, exact: true }).click();
        };
        const dialog = page.getByRole("dialog");
        await act("Accept request");
        await dialog.getByRole("button", { name: "Keep current state", exact: true }).click();
        expect(
          (await db`select status from fkh_friend_requests where id=${request}`)[0].status,
        ).toBe("pending");
        await act("Accept request");
        await dialog.getByRole("button", { name: "Confirm: Accept request", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(tabs.getByRole("tab", { name: "Friends (1)", exact: true })).toBeVisible();
        await tabs.getByRole("tab", { name: "Friends (1)", exact: true }).click();
        await act("Remove friend");
        await dialog.getByRole("button", { name: "Keep current state", exact: true }).click();
        const [a, b] = [owner, player].sort();
        expect(
          (await db`select id from fkh_friendships where user_a_id=${a} and user_b_id=${b}`).length,
        ).toBe(1);
        await act("Remove friend");
        await dialog.getByRole("button", { name: "Confirm: Remove friend", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(tabs.getByRole("tab", { name: "Friends (0)", exact: true })).toBeVisible();
        await page.goto(`/friends?tab=discover&q=${username}`);
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await act("Send friend request");
        await dialog.getByRole("button", { name: "Keep current state", exact: true }).click();
        expect(
          (
            await db`select id from fkh_friend_requests where requester_user_id=${owner} and recipient_user_id=${player}`
          ).length,
        ).toBe(0);
        await act("Send friend request");
        await dialog
          .getByRole("button", { name: "Confirm: Send friend request", exact: true })
          .click();
        await expect(dialog).toHaveCount(0);
        await expect(tabs.getByRole("tab", { name: "Sent (1)", exact: true })).toBeVisible();
        await tabs.getByRole("tab", { name: "Sent (1)", exact: true }).click();
        await expect(page).toHaveURL(/tab=sent/);
        await expect(page).toHaveURL(new RegExp(`q=${username}`));
        await act("Cancel request");
        await dialog.getByRole("button", { name: "Confirm: Cancel request", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(tabs.getByRole("tab", { name: "Sent (0)", exact: true })).toBeVisible();
        await page.goto(`/friends?tab=discover&q=${username}`);
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await act("Block golfer");
        await dialog.getByRole("button", { name: "Confirm: Block golfer", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(tabs.getByRole("tab", { name: "Blocked (1)", exact: true })).toBeVisible();
        await tabs.getByRole("tab", { name: "Blocked (1)", exact: true }).click();
        await act("Unblock golfer");
        await dialog.getByRole("button", { name: "Confirm: Unblock golfer", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(tabs.getByRole("tab", { name: "Blocked (0)", exact: true })).toBeVisible();
        expect(
          (
            await db`select id from fkh_user_blocks where blocker_user_id=${owner} and blocked_user_id=${player}`
          ).length,
        ).toBe(0);
        await page.getByRole("button", { name: "Invite a friend", exact: true }).click();
        const link = await dialog
          .getByRole("textbox", { name: "Invitation link", exact: true })
          .inputValue();
        await dialog.getByRole("button", { name: "Copy invitation link", exact: true }).click();
        await expect(
          dialog.getByRole("status").filter({ hasText: "Invitation link copied" }),
        ).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          (
            await db`select id from fkh_friend_requests where requester_user_id=${owner} and status='pending'`
          ).length,
        ).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P64-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
    expect(errors).toEqual([]);
  } finally {
    if (people.length) await db`delete from fkh_users where id in ${db(people)}`;
    await db.end();
  }
});
