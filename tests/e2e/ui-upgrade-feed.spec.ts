import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Clubhouse feed keeps scope, source identity and reviewed publishing across surfaces", async ({
  page,
  context,
}, info) => {
  const value = process.env.DATABASE_URL;
  const url = value ? new URL(value) : null;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      url?.hostname !== "127.0.0.1" ||
      url.port !== "55432" ||
      url.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
    "Designated fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(300000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const users: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.stack ?? e.message}`));
  try {
    const owner = (
      await db`insert into fkh_users(name) values('Synthetic feed owner') returning id`
    )[0].id;
    users.push(owner);
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              encode({ alg: "none" }),
              encode({ sub: owner, email: "feed@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    const source = crypto.randomUUID();
    const first = (
      await db`insert into fkh_feed_items(user_id,item_type,headline,context,visibility,verification_label,source_type,source_id,created_at) values(${owner},'status_update','Synthetic older update','Old source text','private','Player post','status_update',${source},'2026-09-01T12:00:00Z') returning id`
    )[0].id;
    const latest = (
      await db`insert into fkh_feed_items(user_id,item_type,headline,context,visibility,verification_label,source_type,source_id,created_at) values(${owner},'status_update','Synthetic latest update','Latest source text','private','Player post','status_update',${crypto.randomUUID()},'2026-09-02T12:00:00Z') returning id`
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
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/feed?filter=me")}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", { level: 1, name: "Clubhouse", exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        const controls = page.getByRole("region", { name: "Feed filters" });
        await expect(controls).toContainText("My activity");
        await expect(page.locator("[data-feed-item-id]").first()).toHaveAttribute(
          "data-feed-item-id",
          latest,
        );
        await controls
          .getByRole("textbox", { name: "Search loaded activity", exact: true })
          .fill("No synthetic match");
        await controls.getByRole("button", { name: "Search", exact: true }).click();
        await expect(page.getByText("No activity in this view", { exact: true })).toBeVisible();
        await controls.getByRole("link", { name: "Clear all", exact: true }).click();
        await expect(page).toHaveURL(/\/feed$/);
        await controls.getByRole("button", { name: /Filters/ }).click();
        const dialog = page.getByRole("dialog");
        await dialog
          .getByRole("combobox", { name: "Activity scope", exact: true })
          .selectOption("me");
        await dialog.getByLabel("From (UTC)", { exact: true }).fill("2026-09-02");
        await dialog.getByLabel("To (UTC)", { exact: true }).fill("2026-09-02");
        await dialog.getByRole("button", { name: "Apply filters", exact: true }).click();
        await expect(page.locator("[data-feed-item-id]")).toHaveCount(1);
        await expect(page.locator("[data-feed-item-id]").first()).toHaveAttribute(
          "data-feed-item-id",
          latest,
        );
        await page.reload();
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await expect(controls).toContainText("2026-09-02");
        if (width === 1440 || width === 390) {
          await page.getByRole("button", { name: "Create post", exact: true }).click();
          await dialog
            .getByRole("textbox", { name: "Post text", exact: true })
            .fill(`Synthetic publication ${surface}-${width}`);
          await dialog
            .getByRole("combobox", { name: "Post visibility", exact: true })
            .selectOption("private");
          await dialog.getByRole("button", { name: "Review post", exact: true }).click();
          await expect(dialog).toContainText("Audience: private");
          const before = (await db`select id from fkh_feed_items where user_id=${owner}`).length;
          await dialog.getByRole("button", { name: "Edit draft", exact: true }).click();
          await expect(dialog.getByRole("textbox", { name: "Post text", exact: true })).toHaveValue(
            `Synthetic publication ${surface}-${width}`,
          );
          expect((await db`select id from fkh_feed_items where user_id=${owner}`).length).toBe(
            before,
          );
          await dialog.getByRole("button", { name: "Review post", exact: true }).click();
          await dialog.getByRole("button", { name: "Confirm publish", exact: true }).click();
          await expect(dialog).toContainText("Status update posted.", { timeout: 60000 });
          const saved =
            await db`select id,visibility from fkh_feed_items where user_id=${owner} and context=${`Synthetic publication ${surface}-${width}`}`;
          expect(saved).toHaveLength(1);
          expect(saved[0].visibility).toBe("private");
          await page.keyboard.press("Escape");
          await page.goto("/feed?filter=me");
          await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
          const article = page.locator(`[data-feed-item-id="${saved[0].id}"]`);
          await article.getByRole("button", { name: /^Kudos/ }).click();
          await expect(article.getByRole("button", { name: /^Kudos/ })).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          await article.getByRole("button", { name: /^Comments/ }).click();
          await article
            .getByRole("textbox", { name: "Comment text", exact: true })
            .fill("Synthetic reply");
          await article.getByRole("button", { name: "Post", exact: true }).click();
          await expect(article).toContainText("Synthetic reply");
          expect(
            (
              await db`select id from fkh_feed_comments where feed_item_id=${saved[0].id} and body='Synthetic reply'`
            ).length,
          ).toBe(1);
          await article.getByRole("button", { name: /Activity actions:/ }).click();
          await page.getByRole("menuitem", { name: "Delete post", exact: true }).click();
          await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
          expect((await db`select id from fkh_feed_items where id=${saved[0].id}`).length).toBe(1);
          await article.getByRole("button", { name: /Activity actions:/ }).click();
          await page.getByRole("menuitem", { name: "Delete post", exact: true }).click();
          await dialog.getByRole("button", { name: "Confirm action", exact: true }).click();
          await expect(article).toHaveCount(0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P67-${surface}-${width}.png`),
          animations: "disabled",
        });
        expect(await db`select source_id,context from fkh_feed_items where id=${first}`).toEqual([
          { source_id: source, context: "Old source text" },
        ]);
      }
    expect(errors).toEqual([]);
  } finally {
    if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
    await db.end();
  }
});
