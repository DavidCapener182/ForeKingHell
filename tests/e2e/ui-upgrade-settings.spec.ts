import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Settings exposes every section and retains scoped drafts on both surfaces", async ({
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
  test.setTimeout(360000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  const db = postgres(value!, { max: 1 });
  let user: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    user = (
      await db`insert into fkh_users(name,email) values('Synthetic settings account','settings@forekinghell.local') returning id`
    )[0].id;
    const seededSession = (
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${user!},'manual','range',now(),'Synthetic reset cancellation guard') returning id`
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
              enc({ sub: user, email: "settings@forekinghell.local" }),
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
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent("/settings?section=general")}`,
          { waitUntil: "domcontentloaded" },
        );
        await expect(
          page.getByRole("heading", { level: 1, name: "Settings", exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        const select = async (name: string) => {
          await page.getByRole("button", { name: "All settings sections", exact: true }).click();
          await page.getByRole("button", { name, exact: true }).click();
        };
        const name = `Synthetic settings ${surface}-${width}`;
        await page.getByRole("textbox", { name: "Display name", exact: true }).fill(name);
        await select("Appearance");
        await select("General");
        await expect(page.getByRole("textbox", { name: "Display name", exact: true })).toHaveValue(
          name,
        );
        if (width === 1440 || width === 390) {
          await page.getByRole("button", { name: "Save changes", exact: true }).click();
          await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible(
            { timeout: 60000 },
          );
          expect((await db`select name from fkh_users where id=${user!}`)[0].name).toBe(name);
        } else await page.getByRole("button", { name: "Reset", exact: true }).click();
        for (const section of [
          "Appearance",
          "Privacy",
          "Sharing",
          "Notifications",
          "Connected Data",
          "Offline",
          "Billing",
          "Danger Zone",
        ]) {
          await select(section);
          await expect(
            page
              .locator("section")
              .filter({ has: page.getByRole("heading", { level: 2, name: section, exact: true }) })
              .first(),
          ).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
        }
        await page
          .getByRole("textbox", { name: "Type RESET to confirm", exact: true })
          .fill("RESET");
        await page.getByRole("button", { name: "Reset golf data", exact: true }).click();
        const danger = page.getByRole("alertdialog");
        await expect(danger).toContainText("settings@forekinghell.local");
        await danger.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(danger).toHaveCount(0);
        expect(
          (await db`select raw_csv_text from fkh_sessions where id=${seededSession}`)[0]
            ?.raw_csv_text,
        ).toBe("Synthetic reset cancellation guard");
        expect((await db`select id from fkh_users where id=${user!}`).length).toBe(1);
        await select("Sharing");
        await page.getByRole("button", { name: "Invite collaborator", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByRole("textbox", { name: "Invite email", exact: true })
          .fill(`fixture-${surface}-${width}@example.test`);
        await dialog.getByRole("combobox", { name: "Role", exact: true }).selectOption("viewer");
        await dialog.getByRole("button", { name: "Review invitation", exact: true }).click();
        await expect(dialog).toContainText(`fixture-${surface}-${width}@example.test`);
        const before = (
          await db`select id from fkh_account_invitations where owner_user_id=${user!}`
        ).length;
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          (await db`select id from fkh_account_invitations where owner_user_id=${user!}`).length,
        ).toBe(before);
        await expect(dialog).toHaveCount(0);
        await select("General");
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P71-${surface}-${width}.png`) });
      }
    expect(errors).toEqual([]);
  } finally {
    if (user) await db`delete from fkh_users where id=${user}`;
    await db.end();
  }
});
