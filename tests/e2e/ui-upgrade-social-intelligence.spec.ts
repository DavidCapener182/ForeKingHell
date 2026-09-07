import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Recaps retain saved evidence and reports use explicit named review on both surfaces", async ({
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
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const owners: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.stack ?? e.message}`));
  try {
    for (const name of ["Synthetic recap owner", "Synthetic foreign owner"])
      owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
    const own = (
      await db`insert into fkh_feed_items(user_id,item_type,headline,context,proof_url,visibility) values(${owners[0]},'status_update','Original owned activity','Original source facts','/feed?filter=me','private') returning id`
    )[0].id;
    const foreign = (
      await db`insert into fkh_feed_items(user_id,item_type,headline,visibility) values(${owners[1]},'status_update','Foreign secret headline','private') returning id`
    )[0].id;
    const body = "Original saved recap text. This must remain unchanged when opened again.";
    const summary = (
      await db`insert into fkh_ai_social_summaries(user_id,summary_type,headline,body,evidence_json,visibility,model) values(${owners[0]},'import_recap','Synthetic saved recap',${body},${db.json({ feedItemIds: [own, foreign], generatedFrom: "synthetic_fixture" })},'private','synthetic-fixture') returning id`
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
              enc({ sub: owners[0], email: "recaps@forekinghell.local" }),
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
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/social-intelligence")}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", { level: 1, name: "Recaps & Safety", exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        const dialog = page.getByRole("dialog");
        await page
          .getByRole("button", { name: "Read recap: Synthetic saved recap", exact: true })
          .click();
        await expect(dialog).toContainText(body);
        await expect(dialog).toContainText("Original owned activity");
        await expect(dialog).toContainText("Source activity unavailable");
        await expect(dialog).not.toContainText("Foreign secret headline");
        await expect(
          dialog.getByRole("link", { name: "Open original activity", exact: true }),
        ).toHaveAttribute("href", "/feed?filter=me");
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Generate recap", exact: true }).click();
        await expect(dialog).toContainText("your 1 latest feed activity");
        await dialog
          .getByRole("combobox", { name: "Recap type", exact: true })
          .selectOption("friend_comparison");
        await dialog.getByRole("button", { name: "Review request", exact: true }).click();
        await expect(dialog).toContainText("your activity only");
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          (await db`select id from fkh_ai_social_summaries where user_id=${owners[0]}`).length,
        ).toBe(1);
        if (width === 1440 || width === 390) {
          await page.getByRole("button", { name: "Report content", exact: true }).click();
          await dialog.getByRole("textbox", { name: "Content ID", exact: true }).fill(own);
          await dialog
            .getByRole("textbox", { name: "Reason", exact: true })
            .fill(`Synthetic check ${surface}-${width}`);
          await dialog
            .getByRole("textbox", { name: "Details (optional)", exact: true })
            .fill("Synthetic report detail, no real moderation target");
          await dialog.getByRole("button", { name: "Review request", exact: true }).click();
          await expect(dialog).toContainText(own);
          const before = (
            await db`select id from fkh_social_reports where reporter_user_id=${owners[0]}`
          ).length;
          await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
          expect(
            (await db`select id from fkh_social_reports where reporter_user_id=${owners[0]}`)
              .length,
          ).toBe(before);
          await page.getByRole("button", { name: "Report content", exact: true }).click();
          await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
          await expect(
            dialog.getByRole("textbox", { name: "Content ID", exact: true }),
          ).toHaveValue(own);
          await dialog.getByRole("button", { name: "Review request", exact: true }).click();
          await dialog.getByRole("button", { name: "Confirm report", exact: true }).click();
          await expect(dialog).toHaveCount(0, { timeout: 60000 });
          await expect(
            page.getByRole("status").filter({ hasText: "Report submitted for review" }),
          ).toBeVisible();
          const reports =
            await db`select target_type,target_id,details from fkh_social_reports where reporter_user_id=${owners[0]} and reason=${`Synthetic check ${surface}-${width}`}`;
          expect(reports).toEqual([
            {
              target_type: "feed_item",
              target_id: own,
              details: "Synthetic report detail, no real moderation target",
            },
          ]);
        }
        const search = page.getByRole("textbox", {
          name: "Search your safety records",
          exact: true,
        });
        await search.fill("No record matches");
        await expect(
          page.getByRole("status").filter({ hasText: "No safety records match" }),
        ).toBeVisible();
        await search.fill("");
        if (width < 768) {
          const inspect = page
            .getByRole("button", { name: new RegExp(`Inspect User report: feed_item / ${own}`) })
            .first();
          await inspect.click();
          await expect(dialog).toContainText(own);
          await expect(dialog).toContainText("Synthetic report detail");
          await page.keyboard.press("Escape");
        }
        expect(
          await db`select body,evidence_json from fkh_ai_social_summaries where id=${summary}`,
        ).toEqual([
          {
            body,
            evidence_json: { feedItemIds: [own, foreign], generatedFrom: "synthetic_fixture" },
          },
        ]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P68-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
    expect(errors).toEqual([]);
  } finally {
    if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
    await db.end();
  }
});
