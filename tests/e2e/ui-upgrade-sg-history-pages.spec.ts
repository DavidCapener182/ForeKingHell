import { expect as baseExpect, test } from "@playwright/test";
import postgres from "postgres";
// Full-page server queries may compile while other isolated fixtures run in development.
const expect = baseExpect.configure({ timeout: 30_000 });
test("SG history reaches every saved page and keeps charts and draft source scoped", async ({
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
  test.setTimeout(420000);
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(90000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    const [user] = await db`insert into fkh_users(name) values('SG history isolated') returning id`;
    owner = user.id;
    const rounds =
      await db`insert into fkh_sessions(user_id,source,type,date,course_name,raw_csv_text) select ${owner!},'manual','round','2026-09-01'::timestamptz,'Recent SG course ' || n,'fixture' from generate_series(1,8) n returning id`;
    for (const round of rounds)
      await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,strokes_gained,created_at) select ${owner!},${round.id},'approach','fairway','green',-0.1,'2026-09-01'::timestamptz from generate_series(1,25)`;
    const [old] =
      await db`insert into fkh_sessions(user_id,source,type,date,course_name,raw_csv_text) values(${owner!},'manual','round','2020-01-01','Old historical SG course','fixture') returning id`;
    await db`insert into fkh_strokes_gained_shot_events(user_id,session_id,category,start_lie,end_lie,strokes_gained,created_at) select ${owner!},${old.id},'tee','tee','fairway',case when n=1 then null else -1 end,'2020-01-01'::timestamptz from generate_series(1,5) n`;
    const original =
      await db`select id,strokes_gained,category from fkh_strokes_gained_shot_events where user_id=${owner!} order by id`;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "sg-history@forekinghell.local" }),
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
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const surface of ["workbench", "companion"]) {
      await context.addCookies([
        { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
      ]);
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto("/strokes-gained");
        const rows = page.locator("[data-sg-event]");
        await expect(rows).toHaveCount(200);
        await expect(page.getByRole("button", { name: "Filters (0)", exact: true })).toBeEnabled();
        await expect(page.getByText("200 / 200 events calculated", { exact: false })).toBeVisible();
        await expect(page.getByText(/205 matching saved events/)).toBeVisible();
        await expect(page.locator("[data-sg-round]")).toHaveCount(6);
        await page.getByRole("link", { name: "Next round group", exact: true }).click();
        await expect(page).toHaveURL(/roundPage=2/);
        await expect(page.locator("[data-sg-round]")).toHaveCount(2);
        await page.reload();
        await expect(page.getByRole("button", { name: /^Filters \(/ })).toBeEnabled();
        await expect(page.locator("[data-sg-round]")).toHaveCount(2);
        await page.goBack();
        await expect(page.locator("[data-sg-round]")).toHaveCount(6);
        await page.getByRole("link", { name: "Next analysis page", exact: true }).first().click();
        await expect(page).toHaveURL(/eventPage=2/);
        await expect(rows).toHaveCount(5);
        await expect(page.getByText("4 / 5 events calculated", { exact: false })).toBeVisible();
        const ids = JSON.parse(
          await page.locator('#sg-practice-priority input[name="eventIds"]').inputValue(),
        );
        expect(ids).toHaveLength(5);
        await page.reload();
        await expect(page.getByRole("button", { name: /^Filters \(/ })).toBeEnabled();
        await expect(rows).toHaveCount(5);
        const search = page.getByRole("textbox", {
          name: "Search all saved SG events",
          exact: true,
        });
        await search.fill("Old historical");
        await page.getByRole("button", { name: "Search saved history", exact: true }).click();
        await expect(rows).toHaveCount(5);
        await expect(page).toHaveURL(/q=Old/);
        await expect(page).not.toHaveURL(/eventPage=/);
        if (width === 1440 || width === 390) {
          await page.getByRole("button", { name: /^Filters \(/ }).click();
          const dialog = page.getByRole("dialog");
          const round = dialog.getByRole("combobox", { name: "Round", exact: true });
          await expect(round.locator(`option[value="${old.id}"]`)).toHaveCount(1);
          await round.selectOption(old.id);
          await dialog.getByRole("button", { name: "Apply filters", exact: true }).click();
          await expect(page).toHaveURL(new RegExp(`sessionId=${old.id}`));
          await page.reload();
          await expect(page.getByRole("button", { name: /^Filters \(/ })).toBeEnabled();
          await expect(rows).toHaveCount(5);
          await expect(search).toHaveValue("Old historical");
        }
        if (width === 390) {
          const form = page.locator("#sg-practice-priority form");
          const creationId = await form.locator('input[name="creationId"]').inputValue();
          await form
            .getByRole("button", { name: "Save this drill as a practice draft", exact: true })
            .click();
          await expect(page).toHaveURL(new RegExp(`planId=${creationId}`));
          const [saved] =
            await db`select status,started_at,facility_json from fkh_practice_plans where id=${creationId} and user_id=${owner!}`;
          expect(saved.status).toBe("planned");
          expect(saved.started_at).toBeNull();
          expect(saved.facility_json.generation.sgHandoff).toMatchObject({
            category: "tee",
            sampleSize: 4,
            pendingCount: 1,
            total: -4,
            sessionIds: [old.id],
          });
          expect(new Set(saved.facility_json.generation.sgHandoff.eventIds)).toEqual(new Set(ids));
          await page.goBack();
          await expect(rows).toHaveCount(5);
          await expect(search).toHaveValue("Old historical");
        }
        await search.fill("Nothing matches this history");
        await page.getByRole("button", { name: "Search saved history", exact: true }).click();
        await expect(rows).toHaveCount(0);
        await expect(page.getByText(/0 matching saved events/)).toBeVisible();
        await expect(page.getByRole("button", { name: /^Filters \(/ })).toBeEnabled();
        await page.getByRole("link", { name: "Clear all", exact: true }).first().click();
        await expect(page).toHaveURL(/\/strokes-gained$/);
        await expect(rows).toHaveCount(200);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (width === 1440 || width === 390)
          await page.screenshot({ path: info.outputPath(`P28-history-${surface}-${width}.png`) });
      }
    }
    expect(errors).toEqual([]);
    expect(
      await db`select id,strokes_gained,category from fkh_strokes_gained_shot_events where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
