import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
test("Course tournament alias applies exact selected venue filter", async ({
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

    const courses =
      await db`insert into fkh_courses(name,visibility,created_by_user_id) values('Synthetic selected venue','shared',${users[0]}),('Synthetic other venue','shared',${users[0]}) returning id`;
    for (const [index, course] of courses.entries())
      await db`insert into fkh_tournaments(title,course_id,created_by_user_id,visibility,status,starts_at,ends_at,round_count,screenshot_required,direct_rapsodo_required) values(${index === 0 ? "Selected venue event" : "Other venue event"},${course.id},${users[0]},'public','open',${new Date(Date.now() - 86400000)},${new Date(Date.now() + 86400000)},1,false,false)`;
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
        await page.goto(
          `/courses/${courses[0].id}/tournaments?courseId=${courses[1].id}&tab=active&sort=name`,
          { waitUntil: "domcontentloaded", timeout: 90000 },
        );
        await expect(
          page.getByRole("heading", { name: "Tournaments", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await expect(page).toHaveURL(
          new RegExp(`/tournaments\\?courseId=${courses[0].id}&tab=active&sort=name$`),
        );
        await expect(
          page.getByRole("combobox", { name: "Course filter", exact: true }),
        ).toHaveValue(courses[0].id);
        await expect(page.getByRole("tab", { name: /Active/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(
          page.getByText("Selected venue event", { exact: true }).filter({ visible: true }),
        ).toBeVisible();
        await expect(page.getByText("Other venue event", { exact: true })).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P94-${surface}-${width}.png`) });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_tournaments where created_by_user_id in ${db(users)}`;
      await db`delete from fkh_courses where created_by_user_id in ${db(users)}`;
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
