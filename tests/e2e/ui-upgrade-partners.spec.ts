import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
test("Partners preserves full sponsor and offer fields without tracking previews", async ({
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
  const sponsorIds: string[] = [];
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
    const sponsor = (
      await db`insert into fkh_sponsors(owner_user_id,name,slug,contact_email,website_url) values(${users[0]},'Synthetic sponsor',${`ui-${randomUUID()}`},'sponsor@example.invalid','https://example.invalid/sponsor') returning id`
    )[0].id;
    sponsorIds.push(sponsor);
    const offer = (
      await db`insert into fkh_partner_offers(sponsor_id,title,description,offer_type,target_context,offer_url,coupon_code) values(${sponsor},'Synthetic complete offer','Synthetic full terms: discount is valid for the named golf fixture only.','affiliate','wedge practice','https://example.invalid/offer','GOLF20') returning id`
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
        await page.goto(`/surface/${surface}?next=%2Fpartners`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByRole("heading", { name: "Sponsors and partner offers", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        const create = page.getByRole("button", { name: "Create sponsor", exact: true });
        await expect(create).toBeEnabled({ timeout: 60000 });
        await create.click();
        const panel = page.getByRole("dialog", { name: "Create sponsor", exact: true });
        await panel
          .getByRole("textbox", { name: "Sponsor name", exact: true })
          .fill("Synthetic draft sponsor");
        await panel
          .getByRole("textbox", { name: "Website URL", exact: true })
          .fill("https://example.invalid/draft");
        await panel
          .getByRole("textbox", { name: "Contact email", exact: true })
          .fill("draft@example.invalid");
        await panel.getByRole("button", { name: "Review creation", exact: true }).click();
        await panel.getByRole("button", { name: "Cancel review", exact: true }).click();
        await expect(panel.getByRole("textbox", { name: "Sponsor name", exact: true })).toHaveValue(
          "Synthetic draft sponsor",
        );
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await page.getByRole("button", { name: "Create partner offer", exact: true }).click();
        const offerPanel = page.getByRole("dialog", { name: "Create partner offer", exact: true });
        await offerPanel
          .getByRole("combobox", { name: "Sponsor", exact: true })
          .selectOption(sponsor);
        await offerPanel
          .getByRole("textbox", { name: "Offer title", exact: true })
          .fill("Synthetic draft offer");
        await offerPanel
          .getByRole("textbox", { name: "Offer terms and description", exact: true })
          .fill("Complete draft terms");
        await offerPanel.getByRole("textbox", { name: "Coupon code", exact: true }).fill("DRAFT");
        await offerPanel.getByRole("button", { name: "Review creation", exact: true }).click();
        await expect(offerPanel).toContainText(sponsor);
        await offerPanel.getByRole("button", { name: "Cancel review", exact: true }).click();
        await expect(
          offerPanel.getByRole("textbox", { name: "Coupon code", exact: true }),
        ).toHaveValue("DRAFT");
        await page.keyboard.press("Escape");
        await expect(offerPanel).toHaveCount(0);
        const offers = page.getByRole("region", { name: "Active partner offers", exact: true });
        const card = offers.getByRole("article").filter({ hasText: "Synthetic complete offer" });
        await expect(card).toContainText("Affiliate offer");
        await expect(card).toContainText("GOLF20");
        await expect(card).toContainText("Synthetic full terms");
        await expect(card).toContainText("https://example.invalid/offer");
        await page
          .getByRole("textbox", { name: "Search sponsors", exact: true })
          .fill("Synthetic sponsor");
        await page
          .getByRole("button", { name: "Inspect sponsor Synthetic sponsor", exact: true })
          .click();
        const detail = page.getByRole("dialog", { name: "Synthetic sponsor", exact: true });
        await expect(detail).toContainText(sponsor);
        await expect(detail).toContainText("sponsor@example.invalid");
        await expect(detail).toContainText("https://example.invalid/sponsor");
        await page.keyboard.press("Escape");
        await expect(detail).toHaveCount(0);
        await expect(
          page.locator(
            '[data-slot="drawer-content"], [data-slot="sheet-content"], [data-slot="drawer-overlay"], [data-slot="sheet-overlay"]',
          ),
        ).toHaveCount(0);
        expect(await db`select id from fkh_offer_clicks where offer_id=${offer}`).toHaveLength(0);
        expect(await db`select id from fkh_sponsors where owner_user_id=${users[0]}`).toHaveLength(
          1,
        );
        expect(
          await db`select id from fkh_partner_offers where sponsor_id=${sponsor}`,
        ).toHaveLength(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P82-${surface}-${width}.png`) });
      }
    expect(
      await db`select id from fkh_admin_audit_log where actor_user_id=${users[0]}`,
    ).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    if (users.length) {
      await db`delete from fkh_admin_audit_log where actor_user_id in ${db(users)}`;
      if (sponsorIds.length) {
        await db`delete from fkh_partner_offers where sponsor_id in ${db(sponsorIds)}`;
        await db`delete from fkh_sponsors where id in ${db(sponsorIds)}`;
      }
      await db`delete from fkh_users where id in ${db(users)}`;
    }
    await db.end();
  }
});
