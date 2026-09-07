import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
test("Record boards retain filtered exports, columns and saved views on both surfaces", async ({
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
  test.setTimeout(420000);
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  const check = expect.configure({ timeout: 60000 });
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
      await context.addCookies([
        { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
      ]);
      for (const board of ["hub", "course"]) {
        const route =
          board === "hub" ? "/course-records" : `/courses/${course.id}/records?tab=all_time`;
        const regionName = board === "hub" ? "Course record browser" : "Course categories";
        const searchName =
          board === "hub" ? "Search course, golfer or category" : "Search categories";
        const column = board === "hub" ? "Tees" : "Friend to beat";
        const scope = board === "hub" ? "course-records" : "course-categories";
        for (const [width, height] of [
          [1440, 900],
          [1280, 800],
          [390, 844],
          [360, 800],
          [1023, 800],
          [1024, 800],
        ]) {
          await page.setViewportSize({ width, height });
          await page.goto(route);
          const region = page.getByRole("region", { name: regionName, exact: true });
          const search = region.getByRole("searchbox", { name: searchName, exact: true });
          await check(search).toBeEnabled();
          const filter = board === "hub" ? "Synthetic record course" : "";
          await search.fill(filter);
          await region.getByRole("button", { name: /^Columns/ }).click();
          const choice = page.getByRole("menuitemcheckbox", { name: column, exact: true });
          if ((await choice.getAttribute("aria-checked")) === "true") await choice.click();
          await page.keyboard.press("Escape");
          const downloadPromise = page.waitForEvent("download");
          await region.getByRole("button", { name: "Export", exact: true }).click();
          const download = await downloadPromise;
          const csv = await readFile((await download.path())!, "utf8");
          expect(csv.split("\n")[0]).not.toContain(column);
          expect(csv).toContain(board === "hub" ? "Synthetic record course" : "No verified result");
          expect(csv.split("\n").length).toBeGreaterThan(1);
          if (width === 1440) {
            const title = `Verified ${board} ${surface}`;
            await region.getByRole("button", { name: "Saved views", exact: true }).click();
            await page.getByRole("menuitem", { name: "Save current view", exact: true }).click();
            await page.getByRole("textbox", { name: "View name", exact: true }).fill(title);
            await page.getByRole("button", { name: "Save view", exact: true }).click();
            await check(page.getByRole("dialog")).toBeHidden();
            await search.fill("no-result-after-save");
            await region.getByRole("button", { name: "Saved views", exact: true }).click();
            await page.getByRole("menuitem", { name: new RegExp(`^${title}`) }).click();
            await check(search).toHaveValue(filter);
          }
          await page.reload();
          await check(search).toBeEnabled();
          await check(region.locator('[data-workbench-controls-hydrated="true"]')).toBeVisible();
          await check(search).toHaveValue(filter);
          await check(
            page
              .locator(
                `[data-workbench-scope="${scope}"] [data-column="${board === "hub" ? "tees" : "friend"}"]`,
              )
              .first(),
          ).toBeHidden();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
          await page.screenshot({
            path: info.outputPath(`record-controls-${board}-${surface}-${width}.png`),
            animations: "disabled",
          });
        }
      }
    }
    expect(errors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
