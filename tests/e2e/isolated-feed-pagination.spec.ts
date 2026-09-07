import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("feed pages and filters reach older owned activity on both surfaces", async ({
  page,
  context,
}, info) => {
  const url = process.env.DATABASE_URL;
  const target = url ? new URL(url) : null;
  test.skip(
    info.project.name !== "chromium" ||
      process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
  );
  test.setTimeout(180000);
  const db = postgres(url!, { max: 1 });
  let owner: string | undefined;
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic paginated feed') returning id`
    )[0].id;
    await db`insert into fkh_feed_items(user_id,item_type,headline,visibility,created_at) select ${owner!},'status_update','Recent synthetic activity '||n,'private','2026-01-02' from generate_series(1,40)n`;
    await db`insert into fkh_feed_items(user_id,item_type,headline,visibility,created_at) values(${owner!},'status_update','Needle older owned activity','private','2026-01-01')`;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "synthetic-feed@example.invalid" }),
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
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
        { width: 360, height: 800 },
        { width: 1023, height: 800 },
        { width: 1024, height: 800 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent("/feed?filter=me&from=2026-01-01&to=2026-01-02")}`,
        );
        const older = page.getByRole("link", { name: "Older activity", exact: true });
        await expect(older).toBeVisible();
        await older.click();
        await expect(page.getByText("Needle older owned activity", { exact: true })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("filter")).toBe("me");
        expect(new URL(page.url()).searchParams.get("from")).toBe("2026-01-01");
        await expect(page.getByRole("link", { name: "Older activity", exact: true })).toHaveCount(
          0,
        );
        await page.getByRole("link", { name: "Newer activity", exact: true }).click();
        await expect(older).toBeVisible();
        const search = page.getByLabel("Search activity", { exact: true });
        await search.fill("Needle");
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await expect(page.getByText("Needle older owned activity", { exact: true })).toBeVisible();
        await expect(search).toHaveValue("Needle");
        await expect(page.getByRole("link", { name: "Export this page (1) as CSV" })).toBeVisible();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
          .toBe(true);
        await page.screenshot({ path: info.outputPath(`P67-${surface}-${viewport.width}.png`) });
      }
    }
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
