import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Group clubhouse preserves drafts, member facts and confirmed group consequences on both surfaces", async ({
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
  test.setTimeout(400000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const owners: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.stack ?? e.message}`));
  const login = async (id: string) => {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              enc({ alg: "none" }),
              enc({ sub: id, email: "clubhouse@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
  };
  try {
    for (const name of ["Synthetic clubhouse owner", "Synthetic clubhouse member"])
      owners.push((await db`insert into fkh_users(name) values(${name}) returning id`)[0].id);
    for (const [i, id] of owners.entries())
      await db`insert into fkh_user_profiles(user_id,username,display_name) values(${id},${`p66-${id.slice(0, 8)}`},${i === 0 ? "Synthetic clubhouse owner" : "Synthetic clubhouse member"})`;
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        const slug = `p66-${crypto.randomUUID().slice(0, 8)}`;
        const name = `Synthetic ${slug}`;
        const group = (
          await db`insert into fkh_groups(name,slug,owner_user_id,visibility,group_type) values(${name},${slug},${owners[0]},'private','friends') returning id`
        )[0].id;
        await db`insert into fkh_group_memberships(group_id,user_id,role) values(${group},${owners[0]},'admin'),(${group},${owners[1]},'member')`;
        await login(owners[0]);
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/groups/${slug}?section=activity`)}`,
        );
        await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible({
          timeout: 60000,
        });
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        const tabs = page.getByRole("tablist", { name: "Group sections" });
        await expect(tabs.getByRole("tab", { name: "Activity", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        const dialog = page.getByRole("dialog");
        await page.getByRole("button", { name: "Write group update", exact: true }).click();
        await dialog
          .getByRole("textbox", { name: "Title (optional)", exact: true })
          .fill(`Update ${slug}`);
        await dialog
          .getByRole("textbox", { name: "Update", exact: true })
          .fill(`Retained draft ${slug}`);
        await dialog.getByRole("button", { name: "Keep draft and close", exact: true }).click();
        await tabs.getByRole("tab", { name: "Members", exact: true }).click();
        await page.getByRole("textbox", { name: "Search members", exact: true }).fill("member");
        await page
          .getByRole("button", { name: "Details for Synthetic clubhouse member", exact: true })
          .click();
        await expect(dialog).toContainText("Group role");
        await expect(dialog).toContainText("member");
        await expect(dialog).toContainText("No scoring round this week");
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await tabs.getByRole("tab", { name: "Activity", exact: true }).click();
        await page.getByRole("button", { name: "Write group update", exact: true }).click();
        await expect(dialog.getByRole("textbox", { name: "Update", exact: true })).toHaveValue(
          `Retained draft ${slug}`,
        );
        await dialog.getByRole("button", { name: "Review update", exact: true }).click();
        expect((await db`select id from fkh_group_posts where group_id=${group}`).length).toBe(0);
        await dialog.getByRole("button", { name: "Confirm publish", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: `Update ${slug}`, exact: true }),
        ).toBeVisible();
        expect(await db`select body from fkh_group_posts where group_id=${group}`).toEqual([
          { body: `Retained draft ${slug}` },
        ]);
        await expect(page.getByRole("button", { name: "Delete group", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Delete group", exact: true }).click();
        await expect(dialog).toContainText("every member");
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect((await db`select id from fkh_groups where id=${group}`).length).toBe(1);
        await tabs.getByRole("tab", { name: "Members", exact: true }).click();
        await page.getByRole("textbox", { name: "Search members", exact: true }).fill("");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P66-${surface}-${width}.png`),
          animations: "disabled",
        });
        await login(owners[1]);
        await page.goto(`/surface/${surface}?next=${encodeURIComponent(`/groups/${slug}`)}`);
        await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await expect(page.getByRole("button", { name: "Delete group", exact: true })).toHaveCount(
          0,
        );
        await page.getByRole("button", { name: "Leave group", exact: true }).click();
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          (
            await db`select status from fkh_group_memberships where group_id=${group} and user_id=${owners[1]}`
          )[0].status,
        ).toBe("active");
        await page.getByRole("button", { name: "Leave group", exact: true }).click();
        await dialog.getByRole("button", { name: "Confirm leave", exact: true }).click();
        await expect(page).toHaveURL(/\/groups\?tab=mine/, { timeout: 60000 });
        expect(
          (
            await db`select status from fkh_group_memberships where group_id=${group} and user_id=${owners[1]}`
          )[0].status,
        ).not.toBe("active");
        await login(owners[0]);
        await page.goto(`/surface/${surface}?next=${encodeURIComponent(`/groups/${slug}`)}`);
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await page.getByRole("button", { name: "Delete group", exact: true }).click();
        await dialog.getByRole("button", { name: "Delete permanently", exact: true }).click();
        await expect(page).toHaveURL(/\/groups\?tab=mine/, { timeout: 60000 });
        expect((await db`select id from fkh_groups where id=${group}`).length).toBe(0);
        expect((await db`select id from fkh_group_posts where group_id=${group}`).length).toBe(0);
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
