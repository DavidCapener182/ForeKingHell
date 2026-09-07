import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("History searches every saved session and pages without duplicates on both surfaces", async ({
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
    await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) select ${owner!},'rapsodo','range','2026-09-01'::timestamptz,'Recent history fixture ' || n,'fixture' from generate_series(1,55) n`;
    const [session] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner!},'manual','range','2025-01-01','Needle beyond first page','fixture') returning id`;
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
      await page.goto("/sessions");
      await check(page.locator("[data-session-toolbar]")).toHaveAttribute("data-ready", "true");
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        const rows = page.locator("[data-session-id]");
        await check(rows).toHaveCount(24);
        const search = page.getByRole("searchbox", { name: "Search history" });
        await search.fill("Needle beyond");
        await check(rows).toHaveCount(1);
        await expect(rows.first()).toHaveAttribute("data-session-id", session.id);
        if (width === 1440 || width === 390) {
          const filterTrigger = page
            .getByRole("button", { name: /^Filters/ })
            .filter({ visible: true });
          const usesSheet = (await filterTrigger.count()) > 0;
          if (usesSheet) await filterTrigger.click();
          await page
            .getByRole("button", { name: /Source$/ })
            .filter({ visible: true })
            .click();
          await page.getByRole("option", { name: "Manual", exact: true }).click();
          if (usesSheet)
            await page.getByRole("button", { name: "Apply filters", exact: true }).click();
          await expect(page).toHaveURL(/source=Manual/);
          await check(rows).toHaveCount(1);
        }
        await expect(page.getByRole("navigation", { name: "Session history pages" })).toContainText(
          "1 matching sessions",
        );
        await page.reload();
        await check(page.locator("[data-session-toolbar]")).toHaveAttribute("data-ready", "true");
        await check(rows).toHaveCount(1);
        await expect(search).toHaveValue("Needle beyond");
        {
          const captureDeparture = () =>
            page.evaluate(() => {
              document.addEventListener(
                "click",
                () => {
                  const row = document.querySelector("[data-session-id]")!;
                  sessionStorage.setItem(
                    "p04-departure-scroll",
                    JSON.stringify({
                      y: scrollY,
                      max: document.documentElement.scrollHeight - innerHeight,
                      top: row.getBoundingClientRect().top,
                      height: row.getBoundingClientRect().height,
                    }),
                  );
                },
                { capture: true, once: true },
              );
            });
          if (surface === "workbench") {
            await rows.first().click();
            await expect(page).toHaveURL(new RegExp(`session=${session.id}`));
            const review = page.getByRole("link", { name: "Open full review", exact: true });
            await review.scrollIntoViewIfNeeded();
            await captureDeparture();
            await review.click();
          } else {
            await rows.first().scrollIntoViewIfNeeded();
            await captureDeparture();
            await rows.first().click();
          }
          await check(
            page.getByRole("heading", { level: 1, name: "Needle beyond first page", exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", { name: "No measurements yet", exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("link", { name: "Import measured shots", exact: true }),
          ).toHaveAttribute("href", "/import");
          await page.screenshot({
            path: info.outputPath(`P05-unmeasured-${surface}-${width}.png`),
          });
          await page.goBack();
          await check(page.locator("[data-session-toolbar]")).toHaveAttribute("data-ready", "true");
          await check(rows).toHaveCount(1);
          await expect(search).toHaveValue("Needle beyond");
          await expect
            .poll(() =>
              page.evaluate(() =>
                Math.abs(scrollY - JSON.parse(sessionStorage.getItem("p04-departure-scroll")!).y),
              ),
            )
            .toBeLessThanOrEqual(3);
          const position = await page.evaluate(() => {
            const before = JSON.parse(sessionStorage.getItem("p04-departure-scroll")!);
            const row = document.querySelector("[data-session-id]")!;
            return {
              before,
              after: {
                y: scrollY,
                max: document.documentElement.scrollHeight - innerHeight,
                top: row.getBoundingClientRect().top,
                height: row.getBoundingClientRect().height,
              },
            };
          });
          console.log("P04 Back position", surface, width, JSON.stringify(position));
          await expect(rows.first()).toBeVisible();
          expect(Math.abs(position.after.y - position.before.y)).toBeLessThanOrEqual(3);
          expect(Math.abs(position.after.top - position.before.top)).toBeLessThanOrEqual(3);
          if (width === 390) {
            await page.goForward();
            await check(
              page.getByRole("heading", { name: "No measurements yet", exact: true }),
            ).toBeVisible();
            await page.getByRole("link", { name: "All sessions", exact: true }).click();
            await check(page.locator("[data-session-toolbar]")).toHaveAttribute(
              "data-ready",
              "true",
            );
            await check(rows).toHaveCount(24);
            await expect(search).toHaveValue("");
            await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThanOrEqual(3);
          }
        }
        await search.fill("No matching history record");
        await check(rows).toHaveCount(0);
        await expect(
          page.getByText("No sessions match these filters", { exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Clear all", exact: true }).click();
        await check(rows).toHaveCount(24);
        if (width === 1440 || width === 390) {
          const seen = await rows.evaluateAll((items) =>
            items.map((item) => item.getAttribute("data-session-id")),
          );
          await page.getByRole("link", { name: "Older sessions", exact: true }).click();
          await expect(page).toHaveURL(/historyPage=2/);
          await check(rows).toHaveCount(24);
          const next = await rows.evaluateAll((items) =>
            items.map((item) => item.getAttribute("data-session-id")),
          );
          expect(new Set([...seen, ...next]).size).toBe(48);
          await page.getByRole("link", { name: "Older sessions", exact: true }).click();
          await check(rows).toHaveCount(8);
          expect(await rows.last().getAttribute("data-session-id")).toBe(session.id);
          await page.getByRole("link", { name: "Newer sessions", exact: true }).click();
          await page.getByRole("link", { name: "Newer sessions", exact: true }).click();
          await check(rows).toHaveCount(24);
          await page.screenshot({ path: info.outputPath(`P04-pages-${surface}-${width}.png`) });
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
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
