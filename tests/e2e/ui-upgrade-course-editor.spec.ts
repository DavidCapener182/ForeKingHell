import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Course editor retains hole drafts and saves exact tee geometry", async ({
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
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => console.log("PAGE ERROR", error.stack));
  page.on("response", async (response) => {
    if (!response.url().includes("/_next/") || !response.url().split("?")[0].endsWith(".js"))
      return;
    try {
      const body = await response.text();
      try {
        new Script(body);
      } catch (error) {
        console.log("INVALID SCRIPT", response.url(), String(error), "bytes", body.length);
      }
    } catch {}
  });
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  let viewer: string | undefined;
  try {
    const [user] = await db`insert into fkh_users(name) values('UI impact isolated') returning id`;
    owner = user.id;
    const [session] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'rapsodo','range','2026-09-01','Impact synthetic session','synthetic') returning id`;
    const [club] =
      await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},'7i','ui-impact-7i') returning id`;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,quality_tag,shot_category,review_status,shot_at,source_raw_json) values(${owner!},${session.id},${club.id},'7i',1,150,160,-3,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',2,155,165,4,'good','stock','included','2026-09-01','{}'::jsonb),(${owner!},${session.id},${club.id},'7i',3,160,170,7,'good','stock','included','2026-09-01','{}'::jsonb)`;
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
    const [course] =
      await db`insert into fkh_courses(name,provider,visibility,created_by_user_id) values('Synthetic course editor','manual','private',${owner!}) returning id`;
    const [tee] =
      await db`insert into fkh_tee_sets(course_id,name,par,course_rating,slope_rating,yards) values(${course.id},'Synthetic selected tee',36,35.5,123,3000) returning id`;
    const [secondTee] =
      await db`insert into fkh_tee_sets(course_id,name,par) values(${course.id},'Other tee untouched',36) returning id`;
    for (const teeId of [tee.id, secondTee.id])
      for (let h = 1; h <= 2; h++)
        await db`insert into fkh_holes(course_id,tee_set_id,hole_number,par,yards,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson) select ${course.id},${teeId},${h},4,300,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson from fkh_holes limit 1`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent(`/courses/${course.id}/holes?teeSetId=${tee.id}`)}`,
      );
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.getByRole("tab", { name: "Mapping", exact: true }).click();
        const panel = page.getByRole("tabpanel");
        await panel.getByRole("button", { name: "Edit hole 1", exact: true }).click();
        if (width < 1024) {
          const toggle = panel.getByRole("button", { name: /Hole 1 controls/ });
          if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
        }
        await panel
          .getByRole("spinbutton", { name: "Tee latitude", exact: true })
          .fill("53.123456");
        await panel.getByRole("button", { name: "Edit hole 2", exact: true }).click();
        await panel.getByRole("button", { name: "Edit hole 1", exact: true }).click();
        await expect(
          panel.getByRole("spinbutton", { name: "Tee latitude", exact: true }),
        ).toHaveValue("53.123456");
        await page.getByRole("tab", { name: "Tee sets", exact: true }).click();
        await page.getByRole("button", { name: "Edit tee set", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("textbox", { name: "Tee set", exact: true })).toHaveValue(
          "Synthetic selected tee",
        );
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(dialog).toBeHidden();
        await page.getByRole("tab", { name: "Mapping", exact: true }).click();
        await expect(
          panel.getByRole("spinbutton", { name: "Tee latitude", exact: true }),
        ).toHaveValue("53.123456");
        await page.getByRole("tab", { name: "Holes", exact: true }).click();
        await page.locator("summary").filter({ hasText: "Hole 1 · Mapped" }).click();
        const form = page.locator("#desktop-hole-form-1");
        await expect(
          form.getByRole("spinbutton", { name: "Green lng", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P49-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await page.locator("summary").filter({ hasText: "Hole 1 · Mapped" }).click();
      }
    }
    await page.getByRole("tab", { name: "Mapping", exact: true }).click();
    const panel = page.getByRole("tabpanel");
    await panel.getByRole("button", { name: "Save geometry", exact: true }).click();
    await expect(panel.getByText("Saved hole.", { exact: true })).toBeVisible();
    const saved =
      await db`select tee_set_id,hole_number,tee_lat from fkh_holes where course_id=${course.id}`;
    expect(saved.find((row) => row.tee_set_id === tee.id && row.hole_number === 1)?.tee_lat).toBe(
      53.123456,
    );
    expect(saved.filter((row) => row.tee_lat === 53.123456)).toHaveLength(1);
    await page.getByRole("tab", { name: "Records & rounds", exact: true }).click();
    await page.getByRole("tab", { name: "Rounds", exact: true }).click();
    await expect(page.getByRole("link", { name: "Open rounds", exact: true })).toHaveAttribute(
      "href",
      `/courses/${course.id}?tab=rounds`,
    );
    await page.goto("/courses/new?source=manual");
    await page
      .getByRole("textbox", { name: "Course name", exact: true })
      .fill("Synthetic creation redirect");
    await page.getByRole("textbox", { name: "Tee set", exact: true }).fill("Exact created tee");
    await page.getByRole("button", { name: "Create course", exact: true }).click();
    await expect(page).toHaveURL(/\/courses\/[0-9a-f-]+\/holes/);
    const [created] =
      await db`select c.id,t.id as tee_id from fkh_courses c join fkh_tee_sets t on t.course_id=c.id where c.created_by_user_id=${owner!} and c.name='Synthetic creation redirect' and t.name='Exact created tee'`;
    expect(created).toBeTruthy();
    expect(new URL(page.url()).pathname).toBe(`/courses/${created.id}/holes`);
    await expect(page.getByRole("combobox", { name: "Active tee set", exact: true })).toHaveValue(
      created.tee_id,
    );
    const [viewUser] =
      await db`insert into fkh_users(name) values('Synthetic course reference viewer') returning id`;
    viewer = viewUser.id;
    await db`update fkh_courses set visibility='shared' where id=${course.id}`;
    const viewToken = [
      encode({ alg: "none" }),
      encode({ sub: viewer, email: "reference@forekinghell.local" }),
      "playwright",
    ].join(".");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: viewToken })),
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const surface of ["workbench", "companion"]) {
      await page.goto(
        `/surface/${surface}?next=${encodeURIComponent(`/courses/${course.id}/holes?teeSetId=${tee.id}`)}`,
      );
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.getByRole("tab", { name: "Mapping", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "Read-only course geometry", exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Save geometry", exact: true })).toHaveCount(
          0,
        );
        await page.getByRole("tab", { name: "Tee sets", exact: true }).click();
        await expect(page.getByRole("button", { name: "Edit tee set", exact: true })).toHaveCount(
          0,
        );
        await page.getByRole("tab", { name: "Holes", exact: true }).click();
        await expect(page.getByRole("button", { name: "Save hole", exact: true })).toHaveCount(0);
      }
    }
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    if (viewer) await db`delete from fkh_users where id=${viewer}`;
    await db.end();
  }
});
