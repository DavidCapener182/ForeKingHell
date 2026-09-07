import { expect, test } from "@playwright/test";
import postgres from "postgres";

test.use({ actionTimeout: 15000 });

for (const surface of ["workbench", "companion"]) {
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    test(`fresh owner creates, password-unlocks and revokes a report ${surface} ${width}`, async ({
      page,
      context,
      browser,
    }) => {
      const url = process.env.DATABASE_URL;
      const target = url ? new URL(url) : null;
      test.skip(
        process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
          !target ||
          target.hostname !== "127.0.0.1" ||
          target.port !== "55432" ||
          target.pathname !== "/fkh_redesign" ||
          process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
        "Requires designated disposable environment",
      );
      test.setTimeout(90000);
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const sql = postgres(url!, { max: 1 });
      let userId: string | undefined;
      const visitor = await browser.newContext({
        baseURL: "http://localhost:3116",
        viewport: { width, height },
        storageState: { cookies: [], origins: [] },
      });
      try {
        userId = (
          await sql`insert into fkh_users(name) values('Synthetic report browser owner') returning id`
        )[0].id;
        const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
        const token = [
          encode({ alg: "none" }),
          encode({ sub: userId, email: "synthetic-report@forekinghell.local" }),
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
        await page.goto(`/surface/${surface}?next=%2Fcoach%2Freports`);
        await page.getByLabel("Report title (optional)").fill("Synthetic protected report");
        await page.getByRole("button", { name: "Continue to privacy", exact: true }).click();
        await page.getByLabel("Optional password", { exact: true }).fill("Synthetic password 123");
        await page.getByRole("button", { name: "Review report", exact: true }).click();
        await page.getByRole("button", { name: "Create frozen report link", exact: true }).click();
        await expect(page).toHaveURL(/share=/);
        const shareToken = new URL(page.url()).searchParams.get("share")!;
        expect(await sql`select id from fkh_share_links where user_id=${userId!}`).toHaveLength(1);
        const shared = await visitor.newPage();
        shared.on("pageerror", (error) => errors.push(error.message));
        await shared.goto(`/share/report/${shareToken}`);
        await expect(shared.getByLabel("Password", { exact: true })).toBeVisible();
        await shared.getByLabel("Password", { exact: true }).fill("Wrong password 123");
        await shared.getByRole("button", { name: "Open report", exact: true }).click();
        await expect(
          shared
            .getByRole("alert")
            .filter({ hasText: "That password did not unlock this report. Try again." }),
        ).toBeVisible();
        await shared.getByLabel("Password", { exact: true }).fill("Synthetic password 123");
        await shared.getByRole("button", { name: "Open report", exact: true }).click();
        await expect(
          shared.getByRole("heading", { name: "Synthetic protected report", exact: true }),
        ).toBeVisible();
        const [frozenBefore] =
          await sql`select snapshot_json from fkh_content_exports where user_id=${userId!}`;
        await sql`update fkh_users set name='Changed after freezing' where id=${userId!}`;
        await shared.reload();
        const [frozenAfter] =
          await sql`select snapshot_json from fkh_content_exports where user_id=${userId!}`;
        expect(frozenAfter.snapshot_json).toEqual(frozenBefore.snapshot_json);
        expect(
          await shared.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await shared.screenshot({
          path: `output/playwright/ui-upgrade/report-sharing-${surface}-${width}.png`,
          fullPage: true,
        });
        await sql`update fkh_share_links set expires_at=now()-interval '1 minute' where user_id=${userId!}`;
        await shared.reload();
        await expect(
          shared.getByRole("heading", { name: "Shared report unavailable", exact: true }),
        ).toBeVisible();
        await sql`update fkh_share_links set expires_at=now()+interval '1 day' where user_id=${userId!}`;
        await page.getByRole("button", { name: "Report details and actions", exact: true }).click();
        await page.getByRole("button", { name: "Revoke report link", exact: true }).click();
        await page.getByRole("button", { name: "Confirm revocation", exact: true }).click();
        await expect
          .poll(
            async () =>
              (await sql`select revoked_at from fkh_share_links where user_id=${userId!}`)[0]
                .revoked_at,
          )
          .not.toBeNull();
        await shared.reload();
        await expect(
          shared.getByRole("heading", { name: "Shared report unavailable", exact: true }),
        ).toBeVisible();
        await expect(
          shared.getByRole("heading", { name: "Synthetic protected report", exact: true }),
        ).toHaveCount(0);
        expect(errors).toEqual([]);
      } finally {
        await visitor.close();
        if (userId) await sql`delete from fkh_users where id=${userId}`;
        await sql.end();
      }
    });
  }
}
