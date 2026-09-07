import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Session review retains source-linked practice and complete shot details on both surfaces", async ({
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
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(15000);
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
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
    const check = expect.configure({ timeout: 60000 });
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
        await page.goto(`/sessions/${session.id}`);
        await check(
          page.getByRole("heading", { level: 1, name: "Impact synthetic session", exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        const practice = page.getByRole("link", { name: "Next practice", exact: true });
        expect(
          new URL((await practice.getAttribute("href"))!, "http://localhost:3116").searchParams.get(
            "sourceSessionId",
          ),
        ).toBe(session.id);
        const ledger = page.locator("[data-session-shot-preview]");
        await check(ledger).toContainText("3 shots · Page");
        if (surface === "companion") {
          await check(page.locator("[data-url-tabs]")).toHaveAttribute("data-ready", "true");
          for (const name of ["Clubs & shots", "Next practice", "Review"]) {
            await page.getByRole("tab", { name, exact: true }).click();
            await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute(
              "aria-selected",
              "true",
            );
            if (name === "Clubs & shots") {
              const story = page.getByRole("region", { name: "Session metric story" });
              await check(story).toBeVisible();
              if (width === 390) {
                const nextMetric = story.getByRole("button", { name: "Next", exact: true });
                if (await nextMetric.isEnabled()) {
                  await nextMetric.click();
                  await expect(story.getByRole("status")).not.toHaveText(/^1 of /);
                }
                const position = await story.getByRole("status").textContent();
                await page.getByRole("tab", { name: "Next practice", exact: true }).click();
                await page.getByRole("tab", { name: "Clubs & shots", exact: true }).click();
                await expect(story.getByRole("status")).toHaveText(position!);
              }
            }
          }
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath(`P05-${surface}-${width}.png`) });
      }
    }
    expect(errors).toEqual([]);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
