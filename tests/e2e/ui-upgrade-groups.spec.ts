import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Group directory preserves invitations and reviewed creation on both surfaces", async ({
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
  test.setTimeout(400000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const owners: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.stack ?? e.message}`));
  try {
    const creator = (
      await db`insert into fkh_users(name) values('Synthetic directory owner') returning id`
    )[0].id;
    owners.push(creator);
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        const actor = (
          await db`insert into fkh_users(name) values('Synthetic group member') returning id`
        )[0].id;
        owners.push(actor);
        const slug = `fkh65-${actor.slice(0, 8)}`;
        const name = `Synthetic private crew ${actor.slice(0, 8)}`;
        const group = (
          await db`insert into fkh_groups(name,slug,owner_user_id,visibility,group_type,invite_code) values(${name},${slug},${creator},'private','friends',${crypto.randomUUID()}) returning id`
        )[0].id;
        await db`insert into fkh_group_memberships(group_id,user_id,role) values(${group},${creator},'owner')`;
        const invite = (
          await db`insert into fkh_group_invites(group_id,inviter_user_id,invitee_user_id) values(${group},${creator},${actor}) returning id`
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
                  encode({ sub: actor, email: "groups@forekinghell.local" }),
                  "playwright",
                ].join("."),
              }),
            ),
            domain: "localhost",
            path: "/",
          },
        ]);
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=${encodeURIComponent("/groups?tab=invites")}`);
        await expect(
          page.getByRole("heading", { name: "Groups", level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        const tabs = page.getByRole("tablist", { name: "Group directory sections" });
        await expect(
          tabs.getByRole("tab", { name: "Invitations (1)", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        const dialog = page.getByRole("dialog");
        await page.getByRole("button", { name: "Accept invitation", exact: true }).click();
        await expect(dialog).toContainText(name);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect((await db`select status from fkh_group_invites where id=${invite}`)[0].status).toBe(
          "pending",
        );
        await page.getByRole("button", { name: "Accept invitation", exact: true }).click();
        await dialog
          .getByRole("button", { name: "Confirm: Accept invitation", exact: true })
          .click();
        await expect(dialog).toHaveCount(0);
        await expect(tabs.getByRole("tab", { name: "Invitations (0)", exact: true })).toBeVisible();
        expect(
          (
            await db`select id from fkh_group_memberships where group_id=${group} and user_id=${actor}`
          ).length,
        ).toBe(1);
        await tabs.getByRole("tab", { name: "My groups (1)", exact: true }).click();
        await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
        await tabs.getByRole("tab", { name: /Discover/ }).click();
        await expect(page).toHaveURL(/tab=discover/);
        await page.goBack();
        await expect(page).toHaveURL(/tab=mine/);
        await expect(tabs.getByRole("tab", { name: "My groups (1)", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await page.reload();
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await expect(tabs.getByRole("tab", { name: "My groups (1)", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await page.getByRole("button", { name: "Create group", exact: true }).click();
        await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(`Created ${slug}`);
        await dialog.getByLabel("Visibility", { exact: true }).selectOption("private");
        await dialog
          .getByRole("textbox", { name: "Description", exact: true })
          .fill("Synthetic retained group description");
        await dialog.getByRole("button", { name: "Review group", exact: true }).click();
        await expect(dialog).toContainText("No other members will be invited.");
        await dialog.getByRole("button", { name: "Edit details", exact: true }).click();
        await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(
          `Created ${slug}`,
        );
        await dialog.getByRole("button", { name: "Review group", exact: true }).click();
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect((await db`select id from fkh_groups where owner_user_id=${actor}`).length).toBe(0);
        await page.getByRole("button", { name: "Create group", exact: true }).click();
        await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(`Created ${slug}`);
        await dialog.getByLabel("Visibility", { exact: true }).selectOption("public");
        await dialog.getByRole("button", { name: "Review group", exact: true }).click();
        await expect(dialog).toContainText("This group is public");
        await dialog.getByRole("button", { name: "Confirm creation", exact: true }).click();
        await expect(page).toHaveURL(/\/groups\/created-/, { timeout: 60000 });
        const saved = await db`select id,visibility from fkh_groups where owner_user_id=${actor}`;
        expect(saved).toHaveLength(1);
        expect(saved[0].visibility).toBe("public");
        expect(
          await db`select user_id,role from fkh_group_memberships where group_id=${saved[0].id}`,
        ).toEqual([{ user_id: actor, role: "admin" }]);
        expect(
          (await db`select id from fkh_group_invites where group_id=${saved[0].id}`).length,
        ).toBe(0);
        await page.goto("/groups?tab=mine");
        await expect(
          page.getByRole("link", { name: `Created ${slug}`, exact: true }),
        ).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P65-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
    expect(errors).toEqual([]);
  } finally {
    if (owners.length) {
      await db`delete from fkh_groups where owner_user_id in ${db(owners)}`;
      await db`delete from fkh_users where id in ${db(owners)}`;
    }
    await db.end();
  }
});
