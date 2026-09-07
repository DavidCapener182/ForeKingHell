import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Leaderboards keep full scope filters and player details on both surfaces", async ({
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
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.stack ?? error.message}`));
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic leaderboard golfer') returning id`
    )[0].id;
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              encode({ alg: "none" }),
              encode({ sub: owner, email: "boards@forekinghell.local" }),
              "playwright",
            ].join("."),
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
        if (process.env.P62_SORT_CHECK === "1" && ![1440, 390].includes(width)) continue;
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent("/leaderboard?tab=friends&period=monthly")}`,
        );
        await expect(
          page.getByRole("heading", { level: 1, name: "Leaderboards", exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        const workspace = page.locator("[data-leaderboard-workspace]");
        const controls = page.locator("[data-leaderboard-player-controls]");
        const navigation = page.getByRole("navigation", { name: "Leaderboard boards" });
        await expect(controls.getByRole("status")).toContainText("Monthly XP");
        if (width < 768) {
          await workspace.getByRole("button", { name: /View details for #1/ }).click();
          const detail = page.getByRole("dialog");
          await expect(
            detail.getByText("Unavailable: no prior ranking snapshot", { exact: true }),
          ).toBeVisible();
          await expect(detail.getByText("This month: shots", { exact: true })).toBeVisible();
          await detail.getByRole("button", { name: "Close details", exact: true }).click();
          await controls.getByRole("button", { name: /Filters \(/ }).click();
          const drawer = page.getByRole("dialog");
          await drawer
            .getByRole("combobox", { name: "Leaderboard period", exact: true })
            .selectOption("all-time");
          await drawer
            .getByRole("combobox", { name: "Leaderboard sort by", exact: true })
            .selectOption("player");
          await drawer.getByRole("button", { name: "Apply", exact: true }).click();
        } else {
          await controls
            .getByRole("combobox", { name: "Leaderboard period", exact: true })
            .selectOption("all-time");
          await controls
            .getByRole("combobox", { name: "Leaderboard sort by", exact: true })
            .selectOption("player");
          await controls.getByRole("button", { name: "Apply filters", exact: true }).click();
        }
        await expect(controls.getByRole("status")).toContainText("Total XP");
        await expect(page).toHaveURL(/sort=player/);
        await page.reload();
        await page.addStyleTag({ content: "nextjs-portal {pointer-events:none !important;}" });
        await expect(controls.getByRole("status")).toContainText("All time");
        await controls
          .getByRole("textbox", { name: "Search golfers", exact: true })
          .fill("nonexistent-synthetic-player");
        await controls.getByRole("button", { name: "Apply filters", exact: true }).click();
        await expect(controls.getByRole("status")).toContainText("0 golfers");
        await expect(page).toHaveURL(/q=nonexistent-synthetic-player/);
        await controls.getByRole("button", { name: "Clear all", exact: true }).click();
        await expect(controls.getByRole("status")).toContainText("1 golfers");
        for (const [name, title] of [
          ["Challenges", "Challenge leaderboards"],
          ["Course champions", "Course champions"],
          ["Tournaments", "Tournament leaders"],
        ]) {
          await navigation.getByRole("link", { name, exact: true }).click();
          await expect(workspace.getByRole("heading", { name: title, exact: true })).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }
        await navigation.getByRole("link", { name: "Friends", exact: true }).click();
        await expect(controls.getByRole("status")).toContainText("1 golfers");
        await page.screenshot({
          path: info.outputPath(`P62-${surface}-${width}.png`),
          animations: "disabled",
          fullPage: true,
        });
      }
    expect(errors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
