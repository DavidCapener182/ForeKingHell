import { expect, test } from "@playwright/test";
import postgres from "postgres";

test.use({ actionTimeout: 15000 });

for (const surface of ["companion"] as const) {
  test(`fresh account uploads a CSV through the quick-range ${surface} interface`, async ({
    page,
    context,
  }, info) => {
    const url = process.env.DATABASE_URL;
    const target = url ? new URL(url) : null;
    test.skip(
      process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
        !target ||
        target.hostname !== "127.0.0.1" ||
        target.port !== "55432" ||
        target.pathname !== "/fkh_redesign" ||
        process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
      "Requires the designated disposable server and database",
    );
    test.setTimeout(120000);
    const sql = postgres(url!, { max: 1 });
    let userId: string | undefined;
    const trigger = `quick_upload_${Date.now()}`;
    try {
      userId = (
        await sql`insert into fkh_users(name) values('Synthetic browser import') returning id`
      )[0].id;
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const token = [
        encode({ alg: "none" }),
        encode({ sub: userId, email: "synthetic-browser@forekinghell.local" }),
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
      const fileName = `picker-${userId!}.csv`;
      const csv =
        "Shot Number,Club,Carry Distance,Total Distance,Ball Speed\n1,7 Iron,151,161,111\n2,7 Iron,153,163,112";
      await page.setViewportSize(
        surface === "companion" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      );
      await page.goto(`/surface/${surface}?next=%2Fimport%3Fsource%3Dcsv`);
      await page
        .locator("#companion-csv-file")
        .setInputFiles({ name: fileName, mimeType: "text/csv", buffer: Buffer.from(csv) });
      const confirmation = page.locator("[data-companion-csv-confirmation]");
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByText("New session", { exact: true })).toBeVisible({
        timeout: 60000,
      });
      await sql.unsafe(
        `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.user_id='${userId!}'::uuid then raise exception 'Synthetic upload rejection'; end if; return new; end $$`,
      );
      await sql.unsafe(
        `create trigger ${trigger} before insert on fkh_sessions for each row execute function ${trigger}()`,
      );
      await confirmation
        .getByRole("button", { name: "Save and build review", exact: true })
        .click();
      await expect(confirmation.getByText("Import needs attention", { exact: true })).toBeVisible({
        timeout: 60000,
      });
      await expect(confirmation).toContainText(fileName);
      expect(await sql`select id from fkh_sessions where user_id=${userId!}`).toHaveLength(0);
      expect(await sql`select id from fkh_shots where user_id=${userId!}`).toHaveLength(0);
      await sql.unsafe(`drop function ${trigger}() cascade`);
      await confirmation
        .getByRole("button", { name: "Save and build review", exact: true })
        .click();
      await expect(page).toHaveURL(/\/import\/result\?/, { timeout: 60000 });
      const sessionId = new URL(page.url()).searchParams.get("sessionId");
      expect(sessionId).toBeTruthy();
      const rows = await sql`select id,raw_csv_text from fkh_sessions where user_id=${userId!}`;
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(sessionId);
      expect(rows[0].raw_csv_text).toBe(csv);
      expect(await sql`select id from fkh_shots where user_id=${userId!}`).toHaveLength(2);
      await page.screenshot({ path: info.outputPath("upload-result.png"), fullPage: true });
    } finally {
      await sql.unsafe(`drop function if exists ${trigger}() cascade`);
      if (userId) await sql`delete from fkh_users where id=${userId!}`;
      await sql.end();
    }
  });
}
