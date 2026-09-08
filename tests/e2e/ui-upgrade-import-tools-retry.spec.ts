import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Import history tools recover from a failed chunk with keyboard focus", async ({
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
    "Disposable fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  let attempts = 0;
  let release: () => void = () => {};
  let gate = Promise.resolve();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const [user] =
      await db`insert into fkh_users(name) values('History tools retry fixture') returning id`;
    owner = user.id;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "tools@forekinghell.local" }),
      "playwright",
    ].join(".");
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.route("**/*desktop-workbench-controls_tsx.js", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await gate;
        await route.fulfill({ status: 503, contentType: "text/javascript", body: "" });
      } else await route.continue();
    });
    for (const surface of ["workbench", "companion"]) {
      for (const [width, height] of [
        [1440, 900],
        [390, 844],
        [360, 800],
      ]) {
        attempts = 0;
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent("/import#import-library")}`,
          { waitUntil: "domcontentloaded" },
        );
        const tools = page.locator("[data-import-history-tools]");
        await tools.scrollIntoViewIfNeeded();
        await expect(tools.getByRole("status")).toContainText("Loading saved views");
        release();
        await expect(tools.getByRole("alert")).toContainText("could not load");
        const retry = tools.getByRole("button", { name: "Retry file tools", exact: true });
        await retry.focus();
        await page.keyboard.press("Enter");
        await expect(tools.getByRole("button", { name: "Saved views", exact: true })).toBeFocused();
        expect(attempts).toBe(2);
        const title = await tools.getByText("Import file library", { exact: true }).boundingBox();
        expect(title?.width).toBeGreaterThanOrEqual(120);
        expect(title?.height).toBeLessThan(65);
        await page.screenshot({ path: info.outputPath(`tools-retry-${surface}-${width}.png`) });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    release();
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
