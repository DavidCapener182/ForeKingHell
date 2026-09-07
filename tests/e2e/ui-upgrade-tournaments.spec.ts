import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Tournament directory preserves course alias status and full mobile fields", async ({
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
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic tournament UI') returning id`
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
              encode({ sub: owner, email: "events@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    const courses =
      await db`insert into fkh_courses(name,created_by_user_id,visibility) values('Synthetic championship course with a long exact identity',${owner!},'private'),('Other synthetic course',${owner!},'private') returning id`;
    const tee = (
      await db`insert into fkh_tee_sets(course_id,name,par,yards) values(${courses[0].id},'Synthetic long championship tee',72,6000) returning id`
    )[0].id;
    const starts = new Date(Date.now() - 3600000);
    const future = new Date(Date.now() + 86400000);
    const ends = new Date(Date.now() + 172800000);
    for (const [name, status, start, course] of [
      ["Active", "open", starts, courses[0].id],
      ["Upcoming", "open", future, courses[0].id],
      ["Cancelled", "cancelled", starts, courses[0].id],
      ["Other", "open", starts, courses[1].id],
    ] as const)
      await db`insert into fkh_tournaments(title,description,course_id,tee_set_id,created_by_user_id,visibility,status,starts_at,ends_at,round_count) values(${name + " synthetic long event identity"},'Full synthetic event description',${course},${tee},${owner!},'private',${status},${start},${ends},2)`;
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
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/courses/${courses[0].id}/tournaments`)}`,
        );
        await expect(page).toHaveURL(new RegExp(`courseId=${courses[0].id}`));
        const directory = page.locator("[data-tournament-directory]");
        const tabs = directory.getByRole("tablist", { name: "Tournament status" });
        await expect(
          directory.getByRole("status").filter({ hasText: "events match the selected filters" }),
        ).toContainText("1 active events");
        await tabs.getByRole("tab", { name: /Completed/ }).click();
        await expect(page).toHaveURL(/tab=completed/);
        await expect(
          directory.getByRole("status").filter({ hasText: "events match the selected filters" }),
        ).toContainText("1 completed events");
        await expect(directory.getByText("Check entry requirements", { exact: true })).toHaveCount(
          0,
        );
        await tabs.getByRole("tab", { name: /Upcoming/ }).click();
        await expect(
          directory.getByRole("status").filter({ hasText: "events match the selected filters" }),
        ).toContainText("1 upcoming events");
        await page.reload();
        await expect(tabs.getByRole("tab", { name: /Upcoming/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await tabs.getByRole("tab", { name: /Active/ }).click();
        await expect(page).toHaveURL(/tab=active/);
        if (width < 768) {
          await directory.locator("summary").click();
          await expect(
            directory
              .getByRole("article")
              .getByText("Full synthetic event description", { exact: true }),
          ).toBeVisible();
          await expect(directory.getByText("Visibility", { exact: true })).toBeVisible();
        }
        await directory.getByLabel("Search events", { exact: true }).fill("missing-event");
        await directory.getByRole("button", { name: "Apply filters", exact: true }).click();
        await expect(
          directory.getByRole("status").filter({ hasText: "events match the selected filters" }),
        ).toContainText("0 active events");
        await expect(page).toHaveURL(new RegExp(`courseId=${courses[0].id}`));
        await directory.getByLabel("Search events", { exact: true }).fill("");
        await directory.getByLabel("Event order", { exact: true }).selectOption("name");
        await directory.getByRole("button", { name: "Apply filters", exact: true }).click();
        await expect(
          directory.getByRole("status").filter({ hasText: "events match the selected filters" }),
        ).toContainText("1 active events");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const bounds = await directory.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: info.outputPath(`P60-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
