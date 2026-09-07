import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Today command palette does not mutate dehydrated page content", async ({ browser }, info) => {
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
  let owner: string | undefined;
  const warnings: string[] = [];
  try {
    owner = (
      await db`insert into fkh_users(name) values('Today hydration isolated fixture') returning id`
    )[0].id;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "hydration@forekinghell.local" }),
      "playwright",
    ].join(".");
    for (const surface of ["workbench", "companion"]) {
      const context = await browser.newContext({
        viewport: { width: surface === "workbench" ? 1440 : 390, height: 900 },
      });
      let releasePage!: () => void;
      const pageChunkGate = new Promise<void>((resolve) => {
        releasePage = resolve;
      });
      try {
        await context.addCookies([
          {
            name: "sb-playwright-auth-token",
            value: encodeURIComponent(JSON.stringify({ access_token: token })),
            domain: "localhost",
            path: "/",
          },
        ]);
        const page = await context.newPage();
        await page.route(
          (url) => decodeURIComponent(url.pathname).includes("/today/page.js"),
          async (route) => {
            await pageChunkGate;
            await route.continue();
          },
        );
        page.on("console", (msg) => {
          if (/hydration|hydrated|didn't match/i.test(msg.text()))
            warnings.push(`${surface}: ${msg.text()}`);
        });
        await page.goto(`http://localhost:3116/surface/${surface}?next=%2Ftoday`, {
          waitUntil: "commit",
        });
        await expect(page.locator("[data-command-centre-ready]")).toHaveAttribute(
          "data-command-centre-ready",
          "true",
        );
        const trigger = page.locator("button:visible:not(:disabled)").first();
        await trigger.focus();
        await page.keyboard.press("Control+k");
        const cancel = page.getByRole("button", { name: "Cancel search", exact: true });
        await expect(cancel).toBeVisible();
        await cancel.click();
        await expect(cancel).toBeHidden();
        await expect(trigger).toBeFocused();
        await page.keyboard.press("Control+k");
        await expect(cancel).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(cancel).toBeHidden();
        await expect(trigger).toBeFocused();
        await page.keyboard.press("Control+k");
        await expect(cancel).toBeVisible();
        await cancel.focus();
        releasePage();
        await expect(
          page.getByRole("dialog", { name: "Command palette", exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("combobox", { name: "Search command palette" })).toBeFocused();
        // Readiness of visible page tasks proves the route has hydrated while the dialog is open.
        if (surface === "companion")
          await expect(page.locator("[data-today-workspace-tabs]")).toHaveAttribute(
            "data-ready",
            "true",
          );
        await page.getByRole("combobox", { name: "Search command palette" }).fill("Sessions");
        await expect(page.getByRole("dialog").locator('a[href="/sessions"]')).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("dialog", { name: "Command palette", exact: true }),
        ).toBeHidden();
        await expect(trigger).toBeFocused();
        // A new route entry must not reuse a detached boundary's readiness.
        await page.goto("http://localhost:3116/sessions");
        await page.goto("http://localhost:3116/today", { waitUntil: "domcontentloaded" });
        await expect(page.locator("[data-command-centre-ready]")).toHaveAttribute(
          "data-command-centre-ready",
          "true",
        );
        await page.keyboard.press("Control+k");
        await expect(
          page.getByRole("dialog", { name: "Command palette", exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("combobox", { name: "Search command palette" })).toBeFocused();
        await page.keyboard.press("Escape");
      } finally {
        releasePage();
        await context.close();
      }
    }
    await info.attach("hydration-warnings", {
      body: JSON.stringify(warnings, null, 2),
      contentType: "application/json",
    });
    expect(warnings).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
