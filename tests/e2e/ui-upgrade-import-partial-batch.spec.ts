import { expect, test } from "@playwright/test";
import postgres from "postgres";

const check = expect.configure({ timeout: 30000 });
test("Partial imports retain saved receipts and retry only remaining files", async ({
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
    "Disposable fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(300000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const owners: string[] = [];
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"])
      requests.push(request.postData() ?? "");
  });
  try {
    await db`create or replace function fkh_browser_partial_failure() returns trigger language plpgsql as $$ begin if NEW.file_name = 'second-failure.csv' then raise exception 'Synthetic second-file save failure'; end if; return NEW; end $$`;
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        const [owner] =
          await db`insert into fkh_users(name) values('Synthetic partial import browser') returning id`;
        owners.push(owner.id);
        const enc = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
        await context.clearCookies();
        await context.addCookies([
          {
            name: "sb-playwright-auth-token",
            value: encodeURIComponent(
              JSON.stringify({
                access_token: [
                  enc({ alg: "none" }),
                  enc({ sub: owner.id, email: "partial@example.invalid" }),
                  "playwright",
                ].join("."),
              }),
            ),
            domain: "localhost",
            path: "/",
          },
        ]);
        await db`create trigger fkh_browser_partial_failure before insert on fkh_sessions for each row execute function fkh_browser_partial_failure()`;
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/import?source=csv")}`);
        if (surface === "companion")
          await page.getByRole("button", { name: "Full import workflow", exact: true }).click();
        const form = page.locator('[data-import-ready="true"]');
        await check(form).toBeVisible();
        await form
          .locator('input[type="file"]')
          .first()
          .setInputFiles(
            ["first-saved.csv", "second-failure.csv", "third-pending.csv"].map((name, index) => ({
              name,
              mimeType: "text/csv",
              buffer: Buffer.from(
                `Shot Number,Club,Carry Distance,Total Distance,Ball Speed,Launch Angle,Side Carry\n1,7 Iron,${150 + index},${160 + index},110,18,1\n2,7 Iron,${152 + index},${162 + index},111,19,2`,
              ),
            })),
          );
        await check(form.locator("[data-import-shot-preview]")).toContainText("6 parsed shots");
        await form.getByRole("button", { name: "Confirm settings", exact: true }).click();
        const warnings = form.getByRole("checkbox", { name: /I have reviewed these warnings/ });
        if (await warnings.count()) await warnings.check();
        await form.getByRole("button", { name: "Save import", exact: true }).click();
        const receipts = form.locator("[data-import-batch-receipts]");
        await check(receipts).toContainText("first-saved.csv: Saved");
        await check(receipts).toBeFocused();
        await check(receipts).toContainText("second-failure.csv: Failed");
        await check(receipts).toContainText("third-pending.csv: Not attempted");
        await check(receipts.getByRole("link", { name: "View saved session" })).toHaveCount(1);
        await check(form.locator("[data-import-upload-table]")).not.toContainText(
          "first-saved.csv",
        );
        await check(form.locator("[data-import-shot-preview]")).toContainText("4 parsed shots");
        const saved = await db`select id,raw_csv_text from fkh_sessions where user_id=${owner.id}`;
        expect(saved).toHaveLength(1);
        expect(saved[0].raw_csv_text).toContain("1,7 Iron,150,160");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`partial-${surface}-${width}.png`) });
        await db`drop trigger fkh_browser_partial_failure on fkh_sessions`;
        const before = requests.length;
        if (await warnings.count()) await warnings.check();
        await form.getByRole("button", { name: "Save import", exact: true }).click();
        await check(page).toHaveURL(/\/import\/result\?/);
        const retry = requests.slice(before).find((body) => body.includes("second-failure.csv"));
        expect(retry).toBeDefined();
        expect(retry).not.toContain("first-saved.csv");
        expect(retry).toContain("third-pending.csv");
        expect(await db`select id from fkh_sessions where user_id=${owner.id}`).toHaveLength(3);
        expect(await db`select id from fkh_shots where user_id=${owner.id}`).toHaveLength(6);
      }
    expect(errors).toEqual([]);
  } finally {
    await db`drop trigger if exists fkh_browser_partial_failure on fkh_sessions`;
    await db`drop function if exists fkh_browser_partial_failure()`;
    if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
    await db.end();
  }
});
