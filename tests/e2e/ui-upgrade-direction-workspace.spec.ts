import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
test("workspace exposes owned direction flags and retains unrelated alignment after recovery", async ({
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
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" ||
      info.project.name !== "chromium",
  );
  test.setTimeout(240000);
  const db = postgres(value!, { max: 1 });
  const ids: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const email = `direction-${randomUUID()}@example.invalid`;
    ids.push(
      ...(
        await db`insert into fkh_users(name,email) values('Synthetic direction owner',${email}),('Synthetic direction outsider',${`foreign-${email}`}) returning id`
      ).map((r) => r.id),
    );
    const owned = (
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text,data_confidence_json) values(${ids[0]},'csv','range',now(),'Owned flagged direction session','synthetic',${db.json({ alignment: "misaligned" })}),(${ids[1]},'csv','range',now(),'Foreign hidden direction session','synthetic',${db.json({ alignment: "misaligned" })}) returning id`
    )[0].id;
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: `${enc({ alg: "none" })}.${enc({ sub: ids[0], email })}.playwright`,
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await context.addCookies([
          { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
        ]);
        await page.setViewportSize({ width, height });
        await page.goto("/analyse/workspace");
        await expect(
          page.getByRole("heading", { name: "Analysis workspace", exact: true }),
        ).toBeVisible({ timeout: 90000 });
        const region = page.getByRole("region", { name: "Direction evidence to review" });
        await expect(region).toContainText("1 session needs a direction review.");
        await expect(region.getByRole("link", { name: /Review session:/ })).toHaveAttribute(
          "href",
          `/sessions/${owned}`,
        );
        await expect(page.getByText("Foreign hidden direction session")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`direction-${surface}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    await db`update fkh_sessions set data_confidence_json=${db.json({ alignment: "aligned" })} where id=${owned} and user_id=${ids[0]}`;
    await page.reload();
    await expect(
      page.getByText("No saved alignment or questionable-direction flags need review."),
    ).toBeVisible({ timeout: 60000 });
    expect(errors).toEqual([]);
  } finally {
    if (ids.length) await db`delete from fkh_users where id in ${db(ids)}`;
    await db.end();
  }
});
