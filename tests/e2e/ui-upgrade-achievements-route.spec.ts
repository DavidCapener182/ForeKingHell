import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Achievements full route renders both surfaces", async ({ page, context }, info) => {
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
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.stack ?? error.message}`));
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic achievement golfer') returning id`
    )[0].id;
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              encode({ alg: "none" }),
              encode({ sub: owner, email: "boards@forekinghell.local" }),
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
        [390, 844],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/achievements")}`);
        await expect(
          page.getByRole("heading", { name: "Achievements", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await expect(page.getByRole("button", { name: /XP unlock ledger/ })).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: "Search achievements", exact: true }),
        ).toBeEnabled();
        await expect(
          page.getByRole("heading", { name: "Share an achievement", exact: true }),
        ).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: info.outputPath(`P63-route-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
    expect(errors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
