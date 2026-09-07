import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Tournament detail supports entry review retained submission and withdrawal on both surfaces", async ({
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
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const users: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.stack ?? error.message}`));
  try {
    const people =
      await db`insert into fkh_users(name) values('Synthetic event organiser'),('Synthetic tournament participant') returning id`;
    users.push(...people.map((p) => p.id));
    const [creator, owner] = users;
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              encode({ alg: "none" }),
              encode({ sub: owner, email: "detail@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    const course = (
      await db`insert into fkh_courses(name,created_by_user_id,visibility) values('Synthetic full tournament course',${creator},'shared') returning id`
    )[0].id;
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        if (process.env.P61_MULTIROUND === "1" && ![1440, 390].includes(width)) continue;
        const rounds = process.env.P61_MULTIROUND === "1" ? 2 : 1;
        const event = (
          await db`insert into fkh_tournaments(title,description,course_id,created_by_user_id,visibility,status,starts_at,ends_at,round_count,screenshot_required,direct_rapsodo_required) values('Synthetic tournament detail','Full event description remains readable.',${course},${creator},'public','open',${new Date(Date.now() - 86400000)},${new Date(Date.now() + 86400000)},${rounds},false,false) returning id`
        )[0].id;
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/tournaments/${event}/rules`)}`,
        );
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await expect(
          page.getByRole("heading", { level: 1, name: "Synthetic tournament detail" }),
        ).toBeVisible({ timeout: 60000 });
        const tabs = page.getByRole("tablist", { name: "Tournament sections" });
        await expect(tabs.getByRole("tab", { name: "Rules & entry" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(
          page.getByRole("heading", { level: 1, name: "Synthetic tournament detail" }),
        ).toBeVisible();
        await expect(
          page.getByRole("progressbar", { name: "Submitted tournament rounds" }),
        ).toHaveAttribute("value", "0");
        await page.getByRole("button", { name: "Enter tournament", exact: true }).click();
        const entry = page.getByRole("dialog");
        await expect(
          entry.getByText("Terms and conditions of entry", { exact: true }),
        ).toBeVisible();
        await entry.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          (
            await db`select id from fkh_tournament_entries where tournament_id=${event} and user_id=${owner}`
          ).length,
        ).toBe(0);
        await page.getByRole("button", { name: "Enter tournament", exact: true }).click();
        await entry.getByRole("checkbox").check();
        await entry.getByRole("button", { name: "Review entry", exact: true }).click();
        await entry.getByRole("button", { name: "Accept & enter tournament", exact: true }).click();
        await expect(entry).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Review & submit round 1" })).toBeVisible();
        expect(
          (
            await db`select id from fkh_tournament_entries where tournament_id=${event} and user_id=${owner} and status='entered'`
          ).length,
        ).toBe(1);
        await tabs.getByRole("tab", { name: "Rounds & submissions" }).click();
        const form = page.locator("[data-tournament-submit-form]");
        await form.getByRole("spinbutton", { name: "Gross", exact: true }).fill("72");
        await tabs.getByRole("tab", { name: "Leaderboard", exact: true }).click();
        await tabs.getByRole("tab", { name: "Rounds & submissions" }).click();
        await expect(form.getByRole("spinbutton", { name: "Gross", exact: true })).toHaveValue(
          "72",
        );
        await form.getByRole("button", { name: "Review round 1", exact: true }).click();
        expect(
          (await db`select id from fkh_tournament_submissions where tournament_id=${event}`).length,
        ).toBe(0);
        await form.getByRole("button", { name: "Confirm submission", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "Saved submissions", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("progressbar", { name: "Submitted tournament rounds" }),
        ).toHaveAttribute("value", "1");
        if (rounds === 2) {
          await expect(form.getByRole("spinbutton", { name: "Round", exact: true })).toHaveValue(
            "2",
          );
          await expect(form.getByRole("spinbutton", { name: "Gross", exact: true })).toHaveValue(
            "",
          );
          await expect(
            form.getByRole("button", { name: "Review round 2", exact: true }),
          ).toBeEnabled();
        }
        const saved =
          await db`select id,gross_score,verification_status from fkh_tournament_submissions where tournament_id=${event} and user_id=${owner}`;
        expect(saved).toHaveLength(1);
        expect(saved[0].gross_score).toBe(72);
        expect(saved[0].verification_status).not.toBe("verified");
        await tabs.getByRole("tab", { name: "Rules & entry" }).click();
        await page.getByRole("button", { name: "Withdraw entry", exact: true }).click();
        const withdrawal = page.getByRole("dialog");
        await withdrawal.getByRole("button", { name: "Keep entry", exact: true }).click();
        expect(
          (
            await db`select status from fkh_tournament_entries where tournament_id=${event} and user_id=${owner}`
          )[0].status,
        ).toBe("entered");
        await page.getByRole("button", { name: "Withdraw entry", exact: true }).click();
        await withdrawal.getByRole("button", { name: "Confirm withdrawal", exact: true }).click();
        await expect(withdrawal).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Enter tournament", exact: true }),
        ).toBeVisible();
        expect(
          (
            await db`select status from fkh_tournament_entries where tournament_id=${event} and user_id=${owner}`
          )[0].status,
        ).toBe("withdrawn");
        expect(
          (await db`select id from fkh_tournament_submissions where tournament_id=${event}`).length,
        ).toBe(1);
        await page.goto(`/tournaments/${event}/leaderboard`);
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await expect(tabs.getByRole("tab", { name: "Leaderboard", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P61-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_courses where created_by_user_id in ${db(users)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
