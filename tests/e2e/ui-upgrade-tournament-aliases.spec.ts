import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
for (const [component, alias, tab, label] of [
  ["P95", "leaderboard", "board", "Leaderboard"],
  ["P96", "rounds", "submit", "Rounds & submissions"],
  ["P97", "rules", "rules", "Rules & entry"],
  ["P98", "submit", "submit", "Rounds & submissions"],
])
  test(`${component} canonical event alias retains filters and selected panel`, async ({
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
    page.on("pageerror", (e) => { errors.push(e.message); console.log("REDIRECT PAGE ERROR", e.stack); });
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

      const course = (
        await db`insert into fkh_courses(name,visibility,created_by_user_id) values('Synthetic alias course','shared',${users[0]}) returning id`
      )[0].id;
      const event = (
        await db`insert into fkh_tournaments(title,description,course_id,created_by_user_id,visibility,status,starts_at,ends_at,round_count,screenshot_required,direct_rapsodo_required) values('Synthetic canonical alias event','Frozen fixture event description',${course},${users[0]},'public','open',${new Date(Date.now() - 86400000)},${new Date(Date.now() + 86400000)},1,false,false) returning id`
      )[0].id;
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
          await page.goto(`/tournaments/${event}/${alias}?tab=wrong&filter=a&filter=b`, {
            waitUntil: "domcontentloaded",
            timeout: 90000,
          });
          await expect(
            page.getByRole("heading", {
              name: "Synthetic canonical alias event",
              level: 1,
              exact: true,
            }),
          ).toBeVisible({ timeout: 60000 });
          await expect(page).toHaveURL(
            new RegExp(`/tournaments/${event}\\?tab=${tab}&filter=a&filter=b$`),
            { timeout: 60000 },
          );
          await expect(
            page
              .getByRole("tablist", { name: "Tournament sections" })
              .getByRole("tab", { name: label, exact: true }),
          ).toHaveAttribute("aria-selected", "true");
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
          await page.screenshot({ path: info.outputPath(`${component}-${surface}-${width}.png`) });
          if (width === 390) {
            await page.reload();
            await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute(
              "aria-selected",
              "true",
            );
            await page.goto("/privacy");
            await page.goBack();
            await expect(page).toHaveURL(
              new RegExp(`/tournaments/${event}\\?tab=${tab}&filter=a&filter=b$`),
            );
          }
        }
      }
      expect(
        await db`select id from fkh_tournament_entries where tournament_id=${event}`,
      ).toHaveLength(0);
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
