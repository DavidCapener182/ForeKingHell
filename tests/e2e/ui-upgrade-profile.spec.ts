import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Profile preserves drafts, saved scopes and exact sharing identity on both surfaces", async ({
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
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const ids: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const user = (
      await db`insert into fkh_users(name) values('Synthetic profile fixture') returning id`
    )[0].id;
    ids.push(user);
    const username = `fixture-${user.slice(0, 8)}`;
    const name = "Synthetic golfer with a long display name for mobile identity wrapping";
    await db`insert into fkh_user_profiles(user_id,username,display_name,home_course,bio,public_profile,friend_profile,visibility_settings_json) values(${user},${username},${name},'Synthetic home course','Original profile biography',true,true,${db.json({ rounds: "private", pbs: "friends", bag: "private", achievements: "friends", handicap: "private", practice: "friends", exactShots: "private" })})`;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: user, email: "profile@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/profile")}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible({
          timeout: 60000,
        });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        await page.getByRole("button", { name: "Edit profile", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Edit profile", exact: true });
        await expect(dialog).toBeVisible();
        const draft = `Retained draft ${surface}-${width}`;
        await dialog.getByRole("textbox", { name: "Short golf profile", exact: true }).fill(draft);
        await dialog.getByRole("combobox", { name: "Rounds", exact: true }).selectOption("friends");
        await dialog.getByRole("button", { name: "Close", exact: true }).click();
        expect((await db`select bio from fkh_user_profiles where user_id=${user}`)[0].bio).not.toBe(
          draft,
        );
        await page.getByRole("tab", { name: "Sharing", exact: true }).click();
        await expect(page).toHaveURL(/#sharing$/);
        await expect(page.getByRole("tabpanel")).toContainText("Saved scope");
        await page.getByRole("tab", { name: "Records", exact: true }).click();
        await expect(page.getByRole("tabpanel")).toContainText("No personal course records yet");
        await page.goBack();
        await expect(page.getByRole("tab", { name: "Sharing", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await page.getByRole("button", { name: "Edit profile", exact: true }).click();
        await expect(
          dialog.getByRole("textbox", { name: "Short golf profile", exact: true }),
        ).toHaveValue(draft);
        await expect(dialog.getByRole("combobox", { name: "Rounds", exact: true })).toHaveValue(
          "friends",
        );
        if (width === 1440 || width === 390) {
          await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
          await expect(dialog).not.toBeVisible({ timeout: 60000 });
          await expect(
            page.getByRole("status").filter({ hasText: "Profile and sharing settings saved." }),
          ).toBeVisible();
          const saved = (
            await db`select bio,visibility_settings_json from fkh_user_profiles where user_id=${user}`
          )[0];
          expect(saved.bio).toBe(draft);
          expect(saved.visibility_settings_json.rounds).toBe("friends");
          expect(saved.visibility_settings_json.bag).toBe("private");
        } else await dialog.getByRole("button", { name: "Close", exact: true }).click();
        await page.getByRole("tab", { name: "Overview", exact: true }).click();
        await page.getByRole("button", { name: "Share profile", exact: true }).click();
        const share = page.getByRole("dialog", { name: `Share @${username}`, exact: true });
        await expect(share).toBeVisible();
        const link = await share
          .getByRole("textbox", { name: "Exact profile link", exact: true })
          .inputValue();
        expect(new URL(link).pathname).toBe(`/profile/${username}`);
        await share.getByRole("button", { name: "Copy link", exact: true }).click();
        await expect(share.getByRole("status")).toHaveText("Profile link copied.");
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
        const qr = share.getByRole("img", { name: `QR code linking to @${username}` });
        await expect(qr).toHaveAttribute("src", `/friends/qr/${username}`);
        await expect
          .poll(() =>
            qr.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
          )
          .toBe(true);
        await share.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByRole("tab", { name: "Achievements", exact: true }).click();
        await expect(page.getByRole("tabpanel")).toContainText(
          "XP recorded in the achievement ledger",
        );
        await page.getByRole("tab", { name: "Overview", exact: true }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P69-${surface}-${width}.png`) });
      }
    expect(errors).toEqual([]);
  } finally {
    if (ids.length) await db`delete from fkh_users where id in ${db(ids)}`;
    await db.end();
  }
});
