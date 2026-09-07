import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Analysis workspace saves scoped notes and frozen snapshots on both surfaces", async ({
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
  test.setTimeout(180000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] = await db`insert into fkh_users(name) values('UI impact isolated') returning id`;
    owner = user.id;
    const [session] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'rapsodo','range','2026-09-01','Impact synthetic session','synthetic') returning id`;
    const [club] =
      await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},'7i','ui-impact-7i') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) values(${owner!},${session.id},${club.id},'7i',1,150,160,-3,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',2,155,165,4,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',3,160,170,7,'good','stock','included','2026-09-01','{}'::jsonb)`;
    const original =
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "impact@forekinghell.local" }),
      "playwright",
    ].join(".");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    let created = false;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=/analyse/workspace`);
      await expect(page.locator('[data-url-tabs][data-ready="true"]')).toBeVisible({
        timeout: 60000,
      });
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.getByRole("tab", { name: "Quality", exact: true }).click();
        await page
          .getByRole("textbox", { name: "Search issues", exact: true })
          .fill("unmatched synthetic issue query");
        await expect(page.getByText("0 issue groups", { exact: true })).toBeVisible();
        await page.getByRole("textbox", { name: "Search issues", exact: true }).fill("");
        await page.getByRole("tab", { name: "Notes", exact: true }).click();
        await page.getByRole("button", { name: "Add annotation", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("textbox", { name: "Title", exact: true })
          .fill(created ? "Unsaved note draft" : "UI saved annotation");
        await page
          .getByRole("dialog")
          .getByRole("textbox", { name: "Note", exact: true })
          .fill("Synthetic annotation retaining its evidence context.");
        if (!created) {
          await page.getByRole("button", { name: "Save annotation", exact: true }).click();
          await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60000 });
          await expect(
            page.getByRole("heading", { name: "UI saved annotation", exact: true }),
          ).toBeVisible({ timeout: 60000 });
        } else {
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        }
        await page
          .getByRole("button", { name: "Inspect UI saved annotation", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toContainText(
          "Synthetic annotation retaining its evidence context.",
        );
        await page.getByRole("button", { name: "Close details", exact: true }).click();
        await page.getByRole("tab", { name: "Equipment", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "Equipment change analysis", exact: true }),
        ).toBeVisible();
        await page.getByRole("tab", { name: "Snapshots", exact: true }).click();
        await page.getByRole("button", { name: "Create snapshot", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("textbox", { name: "Snapshot name", exact: true })
          .fill(created ? "Unsaved snapshot draft" : "UI frozen snapshot");
        if (!created) {
          await page
            .getByRole("dialog")
            .getByRole("checkbox", { name: "Carry", exact: true })
            .check();
          await page.getByRole("button", { name: "Save snapshot", exact: true }).click();
          await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60000 });
          await expect(
            page.getByRole("heading", { name: "UI frozen snapshot", exact: true }),
          ).toBeVisible({ timeout: 60000 });
          created = true;
        } else {
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        }
        await page.getByRole("button", { name: "Inspect UI frozen snapshot", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Saved summary");
        await expect(page.getByRole("dialog")).toContainText("Saved filters");
        await page.getByRole("button", { name: "Close details", exact: true }).click();
        await page.getByRole("tab", { name: "Quality", exact: true }).click();
        await expect(page.locator("h1")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: info.outputPath(`P26-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
    }
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
