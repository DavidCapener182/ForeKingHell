import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Course record browser exposes complete records and truthful proof context", async ({
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
  test.setTimeout(180000);
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => console.log("PAGE ERROR", error.stack));
  page.on("response", async (response) => {
    if (!response.url().includes("/_next/") || !response.url().split("?")[0].endsWith(".js"))
      return;
    try {
      const body = await response.text();
      try {
        new Script(body);
      } catch (error) {
        console.log("INVALID SCRIPT", response.url(), String(error), "bytes", body.length);
      }
    } catch {}
  });
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] = await db`insert into fkh_users(name) values('UI impact isolated') returning id`;
    owner = user.id;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "records@forekinghell.local" }),
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
    const [course] =
      await db`insert into fkh_courses(name,country,visibility,created_by_user_id) values('Synthetic record course with long championship identity','United Kingdom','private',${owner!}) returning id`;
    await db`insert into fkh_tee_sets(course_id,name,par,yards) values(${course.id},'Synthetic record tee',72,6000)`;
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
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/course-records")}`);
        await expect(
          page.getByRole("heading", { name: "Course records", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("searchbox", { name: "Search course, golfer or category", exact: true })
          .fill("Synthetic record course");
        const browser = page.getByRole("region", { name: "Course record browser" });
        await expect(browser.getByRole("status")).toContainText("1 of");
        if (width < 768) {
          const card = browser.getByRole("article");
          await expect(card).toHaveCount(1);
          await card.locator("summary").click();
          await expect(card.getByText("Submissions", { exact: true })).toBeVisible();
          await expect(card.getByText("No verified result", { exact: true })).toBeVisible();
          await expect(
            card.getByRole("link", { name: "Open course boards", exact: true }),
          ).toHaveAttribute("href", `/courses/${course.id}/records`);
        } else {
          await expect(browser.getByRole("table")).toContainText("No verified leader");
          await expect(
            browser.getByRole("link", { name: "All course boards", exact: true }).first(),
          ).toHaveAttribute("href", `/courses/${course.id}/records`);
        }
        await browser
          .getByRole("combobox", { name: "Leader", exact: true })
          .selectOption("verified");
        await expect(
          browser.getByText("No boards match these filters", { exact: true }),
        ).toBeVisible();
        await browser.getByRole("button", { name: "Clear filters", exact: true }).click();
        await browser
          .getByRole("combobox", { name: "Sort by", exact: true })
          .selectOption("submissions");
        await expect(page.getByText("Before you submit", { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P55-${surface}-${width}.png`),
          animations: "disabled",
          fullPage: true,
        });
      }
    }
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
