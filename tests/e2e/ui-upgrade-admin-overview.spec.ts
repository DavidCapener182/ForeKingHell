import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Operations console exposes full mobile queues and audit detail only to an active administrator", async ({
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
  test.setTimeout(240000);
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let user: string | undefined;
  let audit: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    user = (
      await db`insert into fkh_users(name,email) values('Synthetic operations admin','operations-ui@example.invalid') returning id`
    )[0].id;
    await db`insert into fkh_admin_users(user_id,role,status) values(${user!},'owner','active')`;
    audit = (
      await db`insert into fkh_admin_audit_log(actor_user_id,action,target_type,target_id) values(${user!},'synthetic_ui_inspection','synthetic_fixture','UI-ADMIN-TARGET') returning id`
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
              enc({ sub: user, email: "operations-ui@example.invalid" }),
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
        await page.goto(`/surface/${surface}?next=%2Fadmin`, { waitUntil: "domcontentloaded" });
        await expect(
          page.getByRole("heading", { name: "Operations console", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        await page.getByRole("button", { name: "All admin sections", exact: true }).click();
        const menu = page.getByRole("dialog", { name: "All admin sections" });
        await menu
          .getByRole("textbox", { name: "Search admin sections", exact: true })
          .fill("moderation");
        await expect(menu.getByRole("link", { name: "Moderation", exact: true })).toHaveAttribute(
          "href",
          "/admin/moderation",
        );
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        if (width < 768) {
          await page.getByRole("button", { name: /System verification.*Details/ }).click();
          const panel = page.getByRole("dialog", { name: "System verification" });
          await expect(panel).toContainText(
            "Missing verification is not treated as system health.",
          );
          await page.keyboard.press("Escape");
          await expect(panel).toHaveCount(0);
        }
        await page.locator("summary").filter({hasText:"Synthetic Ui Inspection"}).click();
        await expect(page.getByText("UI-ADMIN-TARGET", { exact: true })).toBeVisible();
        await expect(page.getByText("Outcome", { exact: true })).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P76-${surface}-${width}.png`) });
      }
    await db`update fkh_admin_users set status='inactive' where user_id=${user!}`;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/admin(?:\?|$)/, { timeout: 60000 });
    await expect(page.getByText("UI-ADMIN-TARGET", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (audit) await db`delete from fkh_admin_audit_log where id=${audit}`;
    if (user) await db`delete from fkh_users where id=${user}`;
    await db.end();
  }
});
