import { expect, test } from "@playwright/test";
import postgres from "postgres";
const check = expect.configure({ timeout: 60000 });

test("G03 searches historical authorised entities on both surfaces with cancellation and retry", async ({
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
    "Designated disposable fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const db = postgres(value!, { max: 1 });
  const owners: string[] = [];
  const courseIds: string[] = [];
  try {
    owners.push(
      ...(
        await db`insert into fkh_users(name) values('G03 isolated owner'),('G03 isolated foreign') returning id`
      ).map((row) => row.id),
    );
    const historical =
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name) values(${owners[0]},'manual','range','2020-01-01','Synthetic','Archive needle session'),(${owners[0]},'manual','round','2020-01-01','Synthetic','Archive needle round'),(${owners[1]},'manual','range','2020-01-01','Synthetic','Archive needle forbidden') returning id,type`;
    await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text,file_name) select ${owners[0]},'manual',case when n%2=0 then 'round' else 'range' end,now(),'Synthetic','Recent distractor '||n from generate_series(1,40) n`;
    courseIds.push(
      ...(
        await db`insert into fkh_courses(name,created_by_user_id,visibility,updated_at) values('Archive needle course',${owners[0]},'private','2020-01-01'),('Archive needle forbidden course',${owners[1]},'private','2020-01-01') returning id`
      ).map((row) => row.id),
    );
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owners[0], email: "g03@forekinghell.local" }),
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
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=%2Ftoday`);
      await check(page.locator("[data-command-centre-ready]")).toHaveAttribute(
        "data-command-centre-ready",
        "true",
      );
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
        { width: 360, height: 800 },
        { width: 1023, height: 800 },
        { width: 1024, height: 800 },
      ]) {
        await page.setViewportSize(viewport);
        await page.keyboard.press("Control+k");
        const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
        const input = dialog.getByRole("combobox", { name: "Search command palette" });
        await input.fill("Archive needle");
        for (const href of [
          `/sessions/${historical[0].id}`,
          `/rounds/${historical[1].id}`,
          `/courses/${courseIds[0]}/records`,
        ])
          await check(dialog.locator(`a[href="${href}"]`)).toBeVisible();
        await check(dialog.getByRole("link", { name: /forbidden/ })).toHaveCount(0);
        await check(dialog.getByRole("button", { name: "Close", exact: true })).toBeInViewport();
        await check(dialog.getByRole("status")).toHaveCount(0);
        await check(input).toBeInViewport();
        await check
          .poll(() =>
            input.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              const hit = document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              );
              return hit === element || element.contains(hit);
            }),
          )
          .toBe(true);
        await page.screenshot({
          path: info.outputPath(`G03-history-${surface}-${viewport.width}.png`),
        });
        await input.fill("no-matching-historical-fixture");
        await check(dialog.getByText(/No matching command/)).toBeVisible();
        await input.press("Escape");
        await check(dialog).toBeHidden();
      }
    }
    let staleStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      staleStarted = resolve;
    });
    let releaseStale!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseStale = resolve;
    });
    let fail = true;
    await page.route("**/api/desktop-workbench/commands*", async (route) => {
      const q = new URL(route.request().url()).searchParams.get("q");
      if (q === "Slow old query") {
        staleStarted();
        await release;
        await route
          .fulfill({
            json: {
              items: [
                {
                  title: "Stale forbidden result",
                  href: "/sessions/stale",
                  detail: "Synthetic",
                  group: "Session",
                  keywords: "slow",
                  type: "session",
                },
              ],
            },
          })
          .catch(() => {});
      } else if (q === "Archive needle" && fail)
        await route.fulfill({ status: 503, json: { items: [] } });
      else await route.continue();
    });
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
    const input = dialog.getByRole("combobox", { name: "Search command palette" });
    await input.fill("Slow old query");
    await started;
    await input.fill("Archive needle");
    await check(dialog.getByRole("alert")).toBeVisible();
    fail = false;
    await dialog.getByRole("button", { name: "Retry search" }).click();
    await check(dialog.locator(`a[href="/sessions/${historical[0].id}"]`)).toBeVisible();
    releaseStale();
    await check(dialog.getByRole("link", { name: /Stale forbidden/ })).toHaveCount(0);
    await input.fill("handicap");
    await check(dialog.locator('a[href="/handicap"]')).toBeVisible();
    await input.fill("Archive needle session");
    const result = dialog.locator(`a[href="/sessions/${historical[0].id}"]`);
    await check(result).toBeVisible();
    await result.click();
    await check(page).toHaveURL(new RegExp(`/sessions/${historical[0].id}(?:\\?|$)`));
  } finally {
    if (courseIds.length) await db`delete from fkh_courses where id in ${db(courseIds)}`;
    if (owners.length) await db`delete from fkh_users where id in ${db(owners)}`;
    await db.end();
  }
});
