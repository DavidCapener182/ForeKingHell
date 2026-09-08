import { expect, test } from "@playwright/test";
import postgres from "postgres";
const check = expect.configure({ timeout: 30000 });
test("Import preserves owned practice context through both surfaces and source changes", async ({
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
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const owners: string[] = [];
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    owners.push(
      ...(
        await db`insert into fkh_users(name) values('Context browser owner'),('Context browser foreign') returning id`
      ).map((r) => r.id),
    );
    const plans =
      await db`insert into fkh_practice_plans(user_id,session_type,time_minutes,energy_level,intent,title,generated_summary) values(${owners[0]},'range',10,'normal','confidence','Owned target plan','Synthetic'),(${owners[1]},'range',10,'normal','confidence','Foreign secret plan','Synthetic') returning id,user_id`;
    const id = plans.find((p) => p.user_id === owners[0])!.id;
    const foreignId = plans.find((p) => p.user_id === owners[1])!.id;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owners[0], email: "context@forekinghell.local" }),
      "playwright",
    ].join(".");
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.route("**/import?**", async (route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
        requests.push(route.request().postData() ?? "");
        await route.fulfill({
          status: 503,
          contentType: "text/plain",
          body: "Synthetic retryable import response",
        });
      } else await route.continue();
    });
    for (const surface of ["workbench", "companion"]) {
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
          `/surface/${surface}?next=${encodeURIComponent(`/import?source=csv&practicePlanId=${id}`)}`,
        );
        const banner = page.locator("[data-import-practice-context]");
        await check(banner).toContainText("Owned target plan");
        if (surface === "companion")
          await page.getByRole("button", { name: "Full import workflow", exact: true }).click();
        const form = page.locator('[data-import-ready="true"]');
        await check(form).toBeVisible();
        if (surface === "workbench") {
          const chooser = page.locator("[data-import-source-card]");
          await chooser.getByText("Try sample data", { exact: true }).click();
          await check(chooser.getByRole("radio", { name: /Try sample data/ })).toBeChecked();
          await chooser.getByRole("link", { name: "Preview sample", exact: true }).click();
          await check(page).toHaveURL(/source=sample/);
          await check(banner).toContainText("Owned target plan");
          await chooser.getByText("Upload CSV", { exact: true }).click();
          await check(chooser.getByRole("radio", { name: /Upload CSV/ })).toBeChecked();
          await chooser.getByRole("link", { name: "Choose CSV files", exact: true }).click();
          await check(page).toHaveURL(/source=csv/);
          await check(page).toHaveURL(new RegExp(id));
          await check(form).toBeVisible();
          await form.getByRole("button", { name: "Clear batch", exact: true }).click();
        }
        await form
          .locator('input[type="file"]')
          .first()
          .setInputFiles({
            name: "synthetic-context.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(
              "Shot Number,Club,Carry Distance,Total Distance,Ball Speed,Launch Angle,Side Carry\n1,7 Iron,150,160,110,18,1\n2,7 Iron,152,162,111,19,2",
            ),
          });
        await check(form.locator("[data-import-shot-preview]")).toContainText("2 parsed shots");
        await form.getByRole("button", { name: "Confirm settings", exact: true }).click();
        const warnings = form.getByRole("checkbox", { name: /I have reviewed these warnings/ });
        if (await warnings.count()) await warnings.check();
        const before = requests.length;
        await form.getByRole("button", { name: "Save import", exact: true }).click();
        await check.poll(() => requests.length).toBe(before + 1);
        expect(requests.at(-1)).toContain(id);
        await check(form.getByRole("button", { name: "Save import", exact: true })).toBeEnabled();
        await check(banner).toContainText("Owned target plan");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`import-context-${surface}-${width}.png`) });
      }
      for (const planId of [foreignId, "invalid"]) {
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/import?source=csv&practicePlanId=${planId}`)}`,
        );
        await check(
          page.getByRole("heading", { name: "Import", exact: true, level: 1 }),
        ).toBeVisible();
        await check(page.locator("[data-import-practice-context]")).toHaveCount(0);
        await check(page.getByText("Foreign secret plan", { exact: true })).toHaveCount(0);
      }
    }
    expect(requests).toHaveLength(12);
    expect(await db`select id from fkh_sessions where user_id=${owners[0]}`).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
    await db.end();
  }
});
