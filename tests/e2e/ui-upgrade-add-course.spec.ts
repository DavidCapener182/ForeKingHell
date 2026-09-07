import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { Script } from "node:vm";
test("Add course retains drafts, canonical selection and incomplete geometry", async ({
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
    let googleFail = true;
    await page.route("**/api/courses/google/search?*", (route) =>
      route.fulfill({
        status: googleFail ? 503 : 200,
        json: googleFail
          ? { message: "Fixture unavailable" }
          : {
              results: [
                {
                  placeId: "synthetic-exact-place",
                  name: "Synthetic course with a deliberately long canonical identity",
                  address: "Distinct address, synthetic village, United Kingdom",
                  country: "UK",
                  latitude: 53,
                  longitude: -3,
                  rating: null,
                  userRatingsTotal: null,
                  types: [],
                },
              ],
            },
      }),
    );
    await page.route("**/api/courses/osm/search?*", (route) =>
      route.fulfill({
        json: {
          results: [
            {
              osmType: "way",
              osmId: 12345,
              name: "Synthetic geometry course",
              displayName: "Synthetic long location for geometry review",
              country: "UK",
              lat: 53,
              lon: -3,
            },
          ],
        },
      }),
    );
    await page.route("**/api/courses/osm/holes?*", (route) =>
      route.fulfill({ json: { holes: [] } }),
    );
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=${encodeURIComponent("/courses/new")}`);
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.getByRole("tab", { name: "Google", exact: true }).click();
        const google = page.getByRole("tabpanel");
        await google
          .getByRole("textbox", { name: "Search Google courses", exact: true })
          .fill("Synthetic");
        googleFail = true;
        await google.getByRole("button", { name: "Search", exact: true }).click();
        await expect(
          google.getByText("Google Places search failed", { exact: true }),
        ).toBeVisible();
        await expect(
          google.getByRole("textbox", { name: "Search Google courses", exact: true }),
        ).toHaveValue("Synthetic");
        googleFail = false;
        await google.getByRole("button", { name: "Search", exact: true }).click();
        await google.getByRole("button", { name: "Select", exact: true }).click();
        await expect(google.locator('input[name="placeId"]')).toHaveValue("synthetic-exact-place");
        await page.getByRole("tab", { name: "Manual entry", exact: true }).click();
        await page
          .getByRole("textbox", { name: "Course name", exact: true })
          .fill("Synthetic draft retained");
        await page.getByRole("textbox", { name: "Tee set", exact: true }).fill("");
        await page.getByRole("button", { name: "Create course", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Tee set", exact: true })).toBeFocused();
        await page.getByRole("tab", { name: "OpenStreetMap", exact: true }).click();
        const osm = page.getByRole("tabpanel");
        await osm
          .getByRole("textbox", { name: "Search OpenStreetMap", exact: true })
          .fill("Synthetic");
        await osm.getByRole("button", { name: "Search", exact: true }).click();
        await osm.getByRole("button", { name: "Review", exact: true }).click();
        await expect(osm.getByText("No tagged holes found", { exact: true })).toBeVisible();
        await expect(osm.locator('input[name="osmId"]')).toHaveValue("12345");
        await page.getByRole("tab", { name: "Manual entry", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Course name", exact: true })).toHaveValue(
          "Synthetic draft retained",
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        await page.screenshot({
          path: info.outputPath(`P47-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    expect((await db`select id from fkh_courses where created_by_user_id=${owner!}`).length).toBe(
      0,
    );
  } finally {
    if (owner) {
      await db`delete from fkh_courses where created_by_user_id=${owner}`;
      await db`delete from fkh_users where id=${owner}`;
    }
    await db.end();
  }
});
