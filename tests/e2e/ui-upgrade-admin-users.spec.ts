import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
test("Account management preserves filter query and exact account role updates on both surfaces", async ({
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
  const users: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `target-${randomUUID()}@example.invalid`;
  try {
    users.push(
      ...(
        await db`insert into fkh_users(name,email) values('Synthetic account owner','account-owner@example.invalid'),('Synthetic managed player',${email}) returning id`
      ).map((r) => r.id),
    );
    await db`insert into fkh_admin_users(user_id,role,status) values(${users[0]},'owner','active')`;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: users[0], email: "account-owner@example.invalid" }),
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
          `/surface/${surface}?next=${encodeURIComponent("/admin/users?q=" + encodeURIComponent(email))}`,
          { waitUntil: "domcontentloaded" },
        );
        await expect(
          page.getByRole("heading", { name: "Account management", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        await page.getByRole("button", { name: "Filters and order (0)", exact: true }).click();
        const filter = page.getByRole("dialog", { name: "Account filters" });
        await filter.getByRole("combobox", { name: "Plan", exact: true }).selectOption("free");
        await filter.getByRole("button", { name: "Apply filters", exact: true }).click();
        await expect(page).toHaveURL(/plan=free/, { timeout: 60000 });
        await expect(
          page.getByRole("textbox", { name: "Search accounts", exact: true }),
        ).toHaveValue(email);
        await expect(filter).toHaveCount(0);
        const trigger =
          width < 768
            ? page.getByRole("button", { name: /Synthetic managed player.*Details/ })
            : page.getByRole("button", {
                name: "Account details for Synthetic managed player",
                exact: true,
              });
        await trigger.click();
        const panel = page.getByRole("dialog", { name: "Synthetic managed player" });
        await expect(panel.locator("dd").filter({ hasText: users[1] })).toBeVisible();
        const form = panel.getByRole("form", { name: "Apply admin role", exact: true });
        await form
          .getByRole("combobox", { name: "Admin role", exact: true })
          .selectOption("operator");
        await form.getByRole("button", { name: "Review apply admin role", exact: true }).click();
        await expect(form).toContainText(email);
        const before = (await db`select role from fkh_admin_users where user_id=${users[1]}`)[0]
          ?.role;
        await form.getByRole("button", { name: "Cancel review", exact: true }).click();
        expect(
          (await db`select role from fkh_admin_users where user_id=${users[1]}`)[0]?.role,
        ).toBe(before);
        if (width === 1440) {
          await form.getByRole("button", { name: "Review apply admin role", exact: true }).click();
          await form.getByRole("button", { name: "Confirm apply admin role", exact: true }).click();
          await expect(form.getByRole("status")).toContainText("Admin access granted.", {
            timeout: 60000,
          });
          expect(
            (await db`select role from fkh_admin_users where user_id=${users[1]}`)[0].role,
          ).toBe("operator");
          await expect(page).toHaveURL(/plan=free/);
        }
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P77-${surface}-${width}.png`) });
      }
    expect((await db`select role from fkh_admin_users where user_id=${users[0]}`)[0].role).toBe(
      "owner",
    );
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)} or target_user_id in ${db(users)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
