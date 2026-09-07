import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Shared account ledger retains all permitted session fields on both surfaces and fails safely after revocation", async ({
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
  const users: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    users.push(
      ...(
        await db`insert into fkh_users(name,email) values('Synthetic shared player with a long identifiable name','shared-owner@example.invalid'),('Synthetic viewer','shared-viewer@example.invalid'),('Unrelated private player','shared-foreign@example.invalid') returning id`
      ).map((r) => r.id),
    );
    await db`insert into fkh_account_memberships(owner_user_id,member_user_id,role) values(${users[0]},${users[1]},'viewer')`;
    await db`insert into fkh_sessions(user_id,source,type,raw_csv_text,date,course_name,file_name,scorecard_json) values(${users[0]},'manual','round','Synthetic fixture',now(),'Synthetic complete course','synthetic-source.csv',${db.json(
      [
        { hole: 1, score: 4 },
        { hole: 2, score: 5 },
      ],
    )}),(${users[0]},'manual','round','Synthetic fixture',now()-interval '1 day','Synthetic incomplete course','partial-source.csv',${db.json([{ hole: 1, score: 4 }, { hole: 2 }])}),(${users[2]},'manual','range','Synthetic fixture',now(),'PRIVATE FOREIGN COURSE','foreign.csv','[]')`;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: users[1], email: "shared-viewer@example.invalid" }),
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
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/shared/" + users[0])}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Synthetic shared player with a long identifiable name",
            exact: true,
          }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        await expect(page.getByText("PRIVATE FOREIGN COURSE", { exact: true })).toHaveCount(0);
        await page
          .getByRole("textbox", { name: "Search recent sessions", exact: true })
          .fill("complete course");
        const details =
          width < 768
            ? page.getByRole("button", { name: /Synthetic complete course.*Details/ })
            : page.getByRole("button", { name: /Details for Synthetic complete course/ });
        await details.click();
        const panel = page.getByRole("dialog", { name: "Shared session details" });
        await expect(panel.getByText("synthetic-source.csv", { exact: true })).toBeVisible();
        await expect(panel.locator("dd").filter({ hasText: /^9$/ })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await page
          .getByRole("textbox", { name: "Search recent sessions", exact: true })
          .fill("incomplete");
        const partial =
          width < 768
            ? page.getByRole("button", { name: /Synthetic incomplete course.*Details/ })
            : page.getByRole("button", { name: /Details for Synthetic incomplete course/ });
        await partial.click();
        await expect(panel.getByText("Incomplete / unavailable", { exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await page.getByRole("textbox", { name: "Search recent sessions", exact: true }).fill("");
        await page.getByRole("button", { name: "Date: newest first", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Date: oldest first", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P74-${surface}-${width}.png`) });
      }
    await db`delete from fkh_account_memberships where owner_user_id=${users[0]}`;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Shared account unavailable", level: 1 }),
    ).toBeVisible({ timeout: 60000 });
    await expect(page.getByText("synthetic-source.csv", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
    await db.end();
  }
});
