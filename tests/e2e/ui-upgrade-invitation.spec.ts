import { expect, test } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
test("Invitation review preserves cancellation and grants only the displayed membership on both surfaces", async ({
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
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    users.push(
      ...(
        await db`insert into fkh_users(name,email) values('Synthetic invitation owner','ui-owner@example.invalid'),('Synthetic invitation recipient','ui-recipient@example.invalid') returning id`
      ).map((r) => r.id),
    );
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: users[1], email: "ui-recipient@example.invalid" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    let index = 0;
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
        const token = randomUUID();
        const role = index++ % 2 ? "editor" : "viewer";
        const [invite] =
          await db`insert into fkh_account_invitations(owner_user_id,invited_email,role,token_hash,status,expires_at) values(${users[0]},'ui-recipient@example.invalid',${role},${createHash("sha256").update(token).digest("hex")},'pending',now()+interval '1 day') returning id`;
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent("/settings/invitations/" + token)}`,
          { waitUntil: "domcontentloaded" },
        );
        await expect(
          page.getByRole("heading", { name: "Account invitation", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important;}" });
        await expect(page.locator("dd").filter({ hasText: role })).toHaveText(role);
        await page.getByRole("button", { name: "Review acceptance", exact: true }).click();
        const panel = page.getByRole("dialog", {
          name: "Accept access from Synthetic invitation owner",
        });
        await panel.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(panel).toHaveCount(0);
        expect(
          (await db`select status from fkh_account_invitations where id=${invite.id}`)[0].status,
        ).toBe("pending");
        expect(
          await db`select id from fkh_account_memberships where owner_user_id=${users[0]}`,
        ).toHaveLength(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P73-${surface}-${width}.png`) });
        await page.getByRole("button", { name: "Review acceptance", exact: true }).click();
        await panel.getByRole("button", { name: "Confirm acceptance", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "Invitation already accepted", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        expect(
          await db`select owner_user_id,member_user_id,role from fkh_account_memberships where owner_user_id=${users[0]}`,
        ).toEqual([{ owner_user_id: users[0], member_user_id: users[1], role }]);
        await db`delete from fkh_account_memberships where owner_user_id=${users[0]}`;
      }
    for (const [status, email, expired, title] of [
      ["pending", "ui-recipient@example.invalid", true, "Invitation expired"],
      ["cancelled", "ui-recipient@example.invalid", false, "Invitation cancelled or unavailable"],
      ["pending", "different@example.invalid", false, "Account invitation"],
    ] as const) {
      const token = randomUUID();
      await db`insert into fkh_account_invitations(owner_user_id,invited_email,role,token_hash,status,expires_at) values(${users[0]},${email},'viewer',${createHash("sha256").update(token).digest("hex")},${status},${new Date(Date.now() + (expired ? -86400000 : 86400000))})`;
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/settings/invitations/" + token, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible({
        timeout: 60000,
      });
      await expect(
        page.getByRole("button", { name: "Review acceptance", exact: true }),
      ).toHaveCount(0);
      if (email === "different@example.invalid")
        await expect(
          page.getByRole("alert").filter({ hasText: "Wrong signed-in account" }),
        ).toBeVisible();
      else
        await expect(page.getByText("Synthetic invitation owner", { exact: true })).toHaveCount(0);
    }
    await page.goto("/settings/invitations/" + randomUUID(), { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Invitation not found", level: 1 })).toBeVisible(
      { timeout: 60000 },
    );
    expect(
      await db`select id from fkh_account_memberships where owner_user_id=${users[0]}`,
    ).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally {
    if (users.length) await db`delete from fkh_users where id in ${db(users)}`;
    await db.end();
  }
});
