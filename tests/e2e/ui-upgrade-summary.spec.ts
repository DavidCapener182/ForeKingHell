import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
test("Summary fallback retains requested context across both surfaces", async ({
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
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" ||
      info.project.name !== "chromium",
  );
  test.setTimeout(240000);
  const db = postgres(value!, { max: 1 });
  const users: string[] = [];
  const email = `handoff-${randomUUID()}@example.invalid`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    users.push(
      ...(
        await db`insert into fkh_users(name,email) values('Synthetic billing administrator','handoff-admin-ui@example.invalid'),('Synthetic resolved billing player',${email}) returning id`
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
              enc({ sub: users[0], email: "handoff-admin-ui@example.invalid" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);

    const from =
      "/achievements/legacy?compareClub=7i&compareMeasure=carry&session=a&session=b#review";
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
        await page.goto(`/companion/summary?from=${encodeURIComponent(from)}`, {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        });
        await expect(
          page.getByRole("heading", { name: "No achievement unlocked yet", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await expect(
          page.getByRole("link", { name: "Open full workspace", exact: true }),
        ).toHaveAttribute("href", `/surface/workbench?next=${encodeURIComponent(from)}`);
        await page.getByText("Requested destination and filters", { exact: true }).click();
        await expect(page.getByText(from, { exact: true })).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Build the next practice", exact: true }),
        ).toBeVisible();
        await expect(page.getByText("No current evidence", { exact: true })).toBeVisible();
        await expect(page.getByText("Supporting driver context", { exact: true })).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P92-${surface}-${width}.png`) });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
