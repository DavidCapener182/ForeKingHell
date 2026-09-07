import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
test("Moderation resolves only reviewed report IDs and shows partial counts independently of events", async ({
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
  test.setTimeout(300000);
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let user: string | undefined;
  const events: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    user = (
      await db`insert into fkh_users(name,email) values('Synthetic moderator','moderation-ui@example.invalid') returning id`
    )[0].id;
    await db`insert into fkh_admin_users(user_id,role,status) values(${user!},'owner','active')`;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: user, email: "moderation-ui@example.invalid" }),
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
        const prefix = randomUUID();
        const reports =
          await db`insert into fkh_social_reports(reporter_user_id,target_type,target_id,reason,details,status) values(${user!},'feed',${prefix + "-one"},'synthetic_spam','Complete first evidence','open'),(${user!},'feed',${prefix + "-two"},'synthetic_spam','Complete second evidence','open') returning id`;
        const event = (
          await db`insert into fkh_moderation_events(actor_user_id,target_type,target_id,event_type,severity,status,reason) values(${user!},'feed',${prefix},'synthetic_detection','high','open','Independent event evidence') returning id`
        )[0].id;
        events.push(event);
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent("/admin/moderation?reportQ=" + prefix + "&eventQ=" + prefix)}`,
          { waitUntil: "domcontentloaded" },
        );
        await expect(
          page.getByRole("heading", { name: "Moderation queue", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        const queue = page.getByRole("region", { name: "User reports", exact: true });
        await expect(
          queue.getByRole("button", { name: "Select visible open records", exact: true }),
        ).toBeEnabled({ timeout: 60000 });
        const eventsRegister = page.getByRole("region", { name: "Moderation events", exact: true });
        for (const [register, included, excluded] of [
          [queue, "Complete first evidence", "Independent event evidence"],
          [eventsRegister, "Independent event evidence", "Complete first evidence"],
        ] as const) {
          const downloadReady = page.waitForEvent("download");
          await register.locator("[data-export-table-id]").click();
          const download = await downloadReady;
          const csv = await readFile((await download.path())!, "utf8");
          expect(csv).toContain(prefix);
          expect(csv).toContain(included);
          expect(csv).not.toContain(excluded);
        }
        await queue.getByRole("button", { name: /^Columns/ }).click();
        await page.getByRole("menuitemcheckbox", { name: "Evidence", exact: true }).click();
        await page.keyboard.press("Escape");
        await expect(
          queue.locator('[data-column="details"]').filter({ visible: true }),
        ).toHaveCount(0);
        const viewName = `Reports ${surface} ${width}`;
        await queue.getByRole("button", { name: "Saved views", exact: true }).click();
        await page.getByRole("menuitem", { name: "Save current view", exact: true }).click();
        const saveView = page.getByRole("dialog", { name: "Save table view" });
        await saveView.getByRole("textbox", { name: "View name" }).fill(viewName);
        await saveView.getByRole("button", { name: "Save view", exact: true }).click();
        await queue
          .getByRole("textbox", { name: "Search reports", exact: true })
          .fill("no-matching-report");
        await expect(
          eventsRegister.getByRole("textbox", { name: "Search events", exact: true }),
        ).toHaveValue(prefix);
        await queue.getByRole("button", { name: "Saved views", exact: true }).click();
        await page.getByRole("menuitem", { name: new RegExp(`^${viewName} `) }).click();
        await expect(
          queue.getByRole("textbox", { name: "Search reports", exact: true }),
        ).toHaveValue(prefix);
        await page.reload();
        await expect(
          queue.getByRole("textbox", { name: "Search reports", exact: true }),
        ).toHaveValue(prefix);
        await expect(
          eventsRegister.getByRole("textbox", { name: "Search events", exact: true }),
        ).toHaveValue(prefix);
        await expect(
          queue.locator('[data-column="details"]').filter({ visible: true }),
        ).toHaveCount(0);
        const hiddenDownloadReady = page.waitForEvent("download");
        await queue.locator("[data-export-table-id]").click();
        const hiddenDownload = await hiddenDownloadReady;
        const hiddenCsv = await readFile((await hiddenDownload.path())!, "utf8");
        expect(hiddenCsv).not.toContain("Complete first evidence");
        expect(hiddenCsv).toContain(prefix);
        await queue.getByRole("button", { name: /^Columns/ }).click();
        await page.getByRole("menuitem", { name: "Show all columns", exact: true }).click();
        await expect(page.getByRole("menu")).toHaveCount(0);
        await queue.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`P78-register-${surface}-${width}.png`) });
        await queue
          .getByRole("button", { name: "Select visible open records", exact: true })
          .click();
        await queue.getByRole("button", { name: "Review 2 selected reports", exact: true }).click();
        const review = page.getByRole("dialog", { name: "Resolve selected reports" });
        await expect(review).toContainText(prefix + "-one");
        await expect(review).toContainText(prefix + "-two");
        await review.getByRole("button", { name: "Keep records open", exact: true }).click();
        await expect(review).toHaveCount(0);
        expect(
          await db`select id from fkh_social_reports where id in ${db(reports.map((r) => r.id))} and status='open'`,
        ).toHaveLength(2);
        await queue.getByRole("button", { name: "Review 2 selected reports", exact: true }).click();
        await db`update fkh_social_reports set status='resolved',resolved_at=now() where id=${reports[0].id}`;
        await review
          .getByRole("button", { name: "Confirm selected resolution", exact: true })
          .click();
        await expect(review.getByRole("status")).toContainText(
          "1 of 2 selected reports resolved.",
          { timeout: 60000 },
        );
        expect(
          (await db`select status from fkh_moderation_events where id=${event}`)[0].status,
        ).toBe("open");
        expect(
          await db`select id from fkh_admin_audit_log where actor_user_id=${user!} and target_id in ${db(reports.map((r) => r.id))}`,
        ).toHaveLength(1);
        await review.getByRole("button", { name: "Review current queue", exact: true }).click();
        await expect(review).toHaveCount(0);
        const eventQueue = page.getByRole("region", { name: "Moderation events", exact: true });
        await eventQueue
          .getByRole("button", { name: `Review event ${event}`, exact: true })
          .click();
        const detail = page.getByRole("dialog", { name: "Synthetic Detection", exact: true });
        await expect(detail).toContainText("Independent event evidence");
        await expect(detail).toContainText("high");
        await page.keyboard.press("Escape");
        await expect(detail).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P78-${surface}-${width}.png`) });
      }
    expect(errors).toEqual([]);
  } finally {
    if (user) {
      await db`delete from fkh_admin_audit_log where actor_user_id=${user}`;
      if (events.length) await db`delete from fkh_moderation_events where id in ${db(events)}`;
      await db`delete from fkh_users where id=${user}`;
    }
    await db.end();
  }
});
