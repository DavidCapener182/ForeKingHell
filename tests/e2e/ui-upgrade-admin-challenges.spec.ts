import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
test("Challenge administration preserves board identity and reviews template edits on both surfaces", async ({
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
  const users: string[] = [];
  const templateIds: string[] = [];
  const email = `billing-${randomUUID()}@example.invalid`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    users.push(
      ...(
        await db`insert into fkh_users(name,email) values('Synthetic billing administrator','billing-admin-ui@example.invalid'),('Synthetic resolved billing player',${email}) returning id`
      ).map((r) => r.id),
    );
    await db`insert into fkh_admin_users(user_id,role,status) values(${users[0]},'owner','active')`;
    const template = (
      await db`insert into fkh_challenge_templates(slug,name,description,challenge_type,rules_json) values(${`ui-${randomUUID()}`},'Synthetic UI template','Synthetic full template description','longest_drive','{"minShots":5}') returning id`
    )[0].id;
    templateIds.push(template);
    const board = (
      await db`insert into fkh_challenges(template_id,creator_user_id,title,visibility) values(${template},${users[1]},'Synthetic full board','private') returning id`
    )[0].id;
    const excludedBoard = (
      await db`insert into fkh_challenges(template_id,creator_user_id,title,visibility) values(${template},${users[1]},'Synthetic excluded board','private') returning id`
    )[0].id;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: users[0], email: "billing-admin-ui@example.invalid" }),
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
        await page.goto(`/surface/${surface}?next=%2Fadmin%2Fchallenges`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", { name: "Challenges and tournaments", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        const search = page.getByRole("textbox", { name: "Search boards", exact: true });
        await expect(search).toBeEnabled({ timeout: 60000 });
        await search.fill("Synthetic full board");
        const register = page.getByRole("region", { name: "Challenge boards", exact: true });
        const downloadReady = page.waitForEvent("download");
        await register.locator("[data-export-table-id]").click();
        const download = await downloadReady;
        const csv = await readFile((await download.path())!, "utf8");
        expect(csv).toContain(board);
        expect(csv).toContain("Synthetic full board");
        expect(csv).toContain("private");
        expect(csv).not.toContain(excludedBoard);
        expect(csv).not.toContain("Synthetic excluded board");
        await register.getByRole("button", { name: /^Columns/ }).click();
        await page.getByRole("menuitemcheckbox", { name: "Owner", exact: true }).click();
        await page.keyboard.press("Escape");
        await expect(
          register.locator('[data-column="owner"]').filter({ visible: true }),
        ).toHaveCount(0);
        const viewName = `Board ${surface} ${width}`;
        await register.getByRole("button", { name: "Saved views", exact: true }).click();
        await page.getByRole("menuitem", { name: "Save current view", exact: true }).click();
        const saveView = page.getByRole("dialog", { name: "Save table view" });
        await saveView.getByRole("textbox", { name: "View name" }).fill(viewName);
        await saveView.getByRole("button", { name: "Save view", exact: true }).click();
        await search.fill("no-matching-board");
        await expect(register).toContainText("No boards match this view.");
        await register.getByRole("button", { name: "Saved views", exact: true }).click();
        await page.getByRole("menuitem", { name: new RegExp(`^${viewName} `) }).click();
        await expect(search).toHaveValue("Synthetic full board");
        await page.reload();
        await expect(search).toHaveValue("Synthetic full board");
        await expect(
          register.locator('[data-column="owner"]').filter({ visible: true }),
        ).toHaveCount(0);
        const hiddenDownloadReady = page.waitForEvent("download");
        await register.locator("[data-export-table-id]").click();
        const hiddenDownload = await hiddenDownloadReady;
        const hiddenCsv = await readFile((await hiddenDownload.path())!, "utf8");
        expect(hiddenCsv).toContain(board);
        expect(hiddenCsv).not.toContain("Synthetic resolved billing player");
        await register.getByRole("button", { name: /^Columns/ }).click();
        await page.getByRole("menuitem", { name: "Show all columns", exact: true }).click();
        await expect(page.getByRole("menu")).toHaveCount(0);
        await register.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`P80-register-${surface}-${width}.png`) });
        await page
          .getByRole("button", { name: "Inspect Synthetic full board", exact: true })
          .click();
        const panel = page.getByRole("dialog", { name: "Synthetic full board", exact: true });
        await expect(panel).toContainText(board);
        await expect(panel).toContainText("private");
        await expect(
          panel.getByRole("link", { name: "Open Synthetic full board", exact: true }),
        ).toHaveAttribute("href", `/challenges/${board}`);
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await page.getByRole("button", { name: "Edit Synthetic UI template", exact: true }).click();
        const editor = page.getByRole("dialog", {
          name: "Edit Synthetic UI template",
          exact: true,
        });
        await expect(editor).toContainText(template);
        await editor.getByRole("button", { name: "Review template save", exact: true }).click();
        await editor.getByRole("button", { name: "Cancel review", exact: true }).click();
        await expect(
          editor.getByRole("textbox", { name: "Template name", exact: true }),
        ).toHaveValue("Synthetic UI template");
        await page.keyboard.press("Escape");
        await expect(editor).toHaveCount(0);
        await expect(
          page.locator(
            '[data-slot="drawer-content"], [data-slot="sheet-content"], [data-slot="drawer-overlay"], [data-slot="sheet-overlay"]',
          ),
        ).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P80-${surface}-${width}.png`) });
      }
    expect(
      await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
    ).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)}`;
      await db`delete from fkh_challenges where creator_user_id in ${db(users)}`;
      if (templateIds.length)
        await db`delete from fkh_challenge_templates where id in ${db(templateIds)}`;
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
