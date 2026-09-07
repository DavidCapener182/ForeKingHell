import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Notification preferences round-trip through both settings entry points at all widths", async ({
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
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let user: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    user = (
      await db`insert into fkh_users(name,email) values('Synthetic notification user','notify@forekinghell.local') returning id`
    )[0].id;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: user, email: "notify@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    let index = 0;
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
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent("/settings/notifications")}`,
          { waitUntil: "domcontentloaded" },
        );
        await expect(
          page.getByRole("heading", { name: "Notifications", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        const next = index++ % 2 === 0 ? "weekly" : "off";
        await page.getByRole("combobox", { name: "Personal best", exact: true }).selectOption(next);
        const toggle = page.getByRole("switch", { name: "Weekly game review", exact: true });
        const wasOn = (await toggle.getAttribute("aria-checked")) === "true";
        await toggle.click();
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("status")).toHaveText("Settings saved.", { timeout: 60000 });
        const prefs = (
          await db`select highlight_settings_json from fkh_user_feature_preferences where user_id=${user!}`
        )[0].highlight_settings_json.notifications;
        expect(prefs.delivery.personalBest).toBe(next);
        expect(prefs.weeklyReview).toBe(!wasOn);
        await expect(page.getByRole("combobox")).toHaveCount(9);
        await expect(page.getByRole("switch")).toHaveCount(5);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P72-${surface}-${width}.png`) });
        await page.locator('a[href="/settings?section=notifications"]').click();
        await expect(
          page.getByRole("heading", { level: 1, name: "Settings", exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await expect(
          page.getByRole("combobox", { name: "Personal best", exact: true }),
        ).toContainText(next === "weekly" ? "Weekly email" : "Off");
        await expect(
          page.getByRole("switch", { name: "Weekly game review", exact: true }),
        ).toHaveAttribute("aria-checked", String(!wasOn));
      }
    expect(errors).toEqual([]);
  } finally {
    if (user) await db`delete from fkh_users where id=${user}`;
    await db.end();
  }
});
