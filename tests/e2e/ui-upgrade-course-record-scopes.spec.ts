import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Course records preserve scope navigation and exact category submission targets", async ({
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
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/courses/${course.id}/records?tab=all_time`)}`,
        );
        await expect(
          page.getByRole("heading", {
            name: "Synthetic record course with long championship identity",
            exact: true,
          }),
        ).toBeVisible();
        const tabs = page.getByRole("tablist", { name: "Course record scopes" });
        await tabs.getByRole("tab", { name: /^Monthly/ }).click();
        await expect(page).toHaveURL(/tab=month/);
        await expect(tabs.getByRole("tab", { name: /^Monthly/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await page.reload();
        await expect(tabs.getByRole("tab", { name: /^Monthly/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await tabs.getByRole("tab", { name: /^Friends/ }).click();
        await expect(page).toHaveURL(/tab=friends/);
        await page.goBack();
        await expect(page).toHaveURL(/tab=month/);
        await page.goForward();
        await expect(page).toHaveURL(/tab=friends/);
        await tabs.getByRole("tab", { name: /^All-time/ }).click();
        await expect(page).toHaveURL(/tab=all_time/);
        const categories = page.getByRole("region", { name: "Course categories" });
        await categories
          .getByRole("searchbox", { name: "Search categories", exact: true })
          .fill("no-such-category");
        await expect(
          categories.getByText("No categories match your search.", { exact: true }),
        ).toBeVisible();
        await categories
          .getByRole("button", { name: "Clear category search", exact: true })
          .click();
        await categories.getByRole("button", { name: "Category A–Z", exact: true }).click();
        if (width < 768) {
          const card = categories.getByRole("article").first();
          await card.locator("summary").click();
          await expect(card.getByText("Your verified best", { exact: true })).toBeVisible();
        }
        const href = await categories
          .getByRole("link", { name: "Check eligibility and submit", exact: true })
          .first()
          .getAttribute("href");
        const id = href!.split("/").pop()!.split("#")[0];
        const [record] = await db`select course_id from fkh_course_records where id=${id}`;
        expect(record.course_id).toBe(course.id);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P56-${surface}-${width}.png`),
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
