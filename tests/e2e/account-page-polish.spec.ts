import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("account page controls preserve drafts, focus and truthful recovery", async ({ page }) => {
  test.setTimeout(120000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/account-pages.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture-account",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://account-pages.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Synthetic account page checks</title></head><body style="font-family:system-ui,sans-serif"><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("output/page-review-account", { recursive: true });
  for (const width of [390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://account-pages.fixture/settings");
    await page.addStyleTag({ content: css.css });
    for (const file of bundle.outputFiles.filter((item) => item.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((item) => item.path.endsWith(".js"))!.text,
    });
    const search = page.getByRole("searchbox", { name: "Find a settings section" });
    if (width >= 1024)
      await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await search.fill("unmatched request");
    await expect(
      page.getByRole("status").filter({ hasText: "No settings sections match" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("");
    if (width >= 1024) {
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeFocused();
    }
    await page.getByRole("button", { name: "Privacy", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Privacy", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "All settings sections" }).click();
    await expect(search).toBeFocused();
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await page.getByLabel("Fixture display name").fill("Unsaved fixture draft");
    await page.getByRole("button", { name: "All settings sections" }).click();
    await page.getByRole("button", { name: "Privacy", exact: true }).click();
    await page.getByRole("button", { name: "All settings sections" }).click();
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(page.getByLabel("Fixture display name")).toHaveValue("Unsaved fixture draft");
    await page.getByRole("button", { name: "All settings sections" }).click();
    await page.getByRole("button", { name: "Privacy", exact: true }).click();
    await page.goBack();
    if (width < 1024) await expect(search).toBeFocused();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeFocused();
    await expect(page.getByLabel("Fixture display name")).toHaveValue("Unsaved fixture draft");
    await page.goForward();
    if (width < 1024) await expect(search).toBeFocused();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Privacy", exact: true })).toBeFocused();
    await page.goBack();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Try loading again" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Fixture retries: 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Recorded date:/ })).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "No subscription history is recorded" }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/page-review-account/synthetic-account-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
