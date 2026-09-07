import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Comparison modes retain scope, save and reopen across both surfaces", async ({
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
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent("/compare?view=progress&focusId=last-30&baselineId=previous-30")}`,
      );
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
        await page.getByRole("tab", { name: "Progress", exact: true }).click();
        const workspace = page.locator('[data-comparison-workspace="progress"]');
        await workspace
          .getByRole("button", { name: /Focus Latest 7 days \/ 30-day baseline/ })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("textbox", { name: "Search focus", exact: true })
          .fill("30");
        await expect(page.getByRole("dialog")).toContainText("1 results");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /Latest 7 days \/ 30-day baseline/ })
          .click();
        await workspace.getByRole("button", { name: "Compare", exact: true }).click();
        await workspace.getByRole("button", { name: "Inspect evidence", exact: true }).click();
        await page
          .getByRole("textbox", { name: "Search club movement", exact: true })
          .fill("unmatched club");
        await expect(page.getByRole("dialog")).toContainText("0 clubs");
        await page.getByRole("textbox", { name: "Search club movement", exact: true }).fill("");
        await page.getByRole("button", { name: "Close evidence", exact: true }).click();
        await expect(page.getByRole("dialog")).toBeHidden();
        await workspace.getByRole("button", { name: "Save comparison", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("textbox", { name: "Name", exact: true })
          .fill(created ? "Unsaved comparison" : "UI monthly comparison");
        if (!created) {
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Save comparison", exact: true })
            .click();
          await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60000 });
          await expect(
            workspace.getByRole("link", { name: "Reopen UI monthly comparison", exact: true }),
          ).toBeVisible({ timeout: 60000 });
          created = true;
        } else
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        for (const mode of ["Clubs", "Players", "Progress"])
          await page.getByRole("tab", { name: mode, exact: true }).click();
        await expect(page).toHaveURL(/focusId=last-30/);
        await expect(
          workspace.getByRole("button", { name: /Focus Latest 7 days \/ 30-day baseline/ }),
        ).toBeVisible();
        await expect(page.locator("h1:visible")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P27-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await page
      .locator('[data-comparison-workspace="progress"]')
      .getByRole("button", { name: "Reset", exact: true })
      .click();
    await expect(page).toHaveURL(/focusId=last-7/);
    await page.getByRole("link", { name: "Reopen UI monthly comparison", exact: true }).click();
    await expect(page).toHaveURL(/focusId=last-30/);
    await expect(
      page
        .locator('[data-comparison-workspace="progress"]')
        .getByRole("button", { name: /Focus Latest 7 days \/ 30-day baseline/ }),
    ).toBeVisible({ timeout: 60000 });
    const saved =
      await db`select filters_json,chart_state_json from fkh_analysis_snapshots where user_id=${owner!}`;
    expect(saved).toHaveLength(1);
    expect(saved[0].filters_json.focusId).toBe("last-30");
    expect(saved[0].chart_state_json.compareView).toBe("progress");
    const after =
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
    expect(after).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
