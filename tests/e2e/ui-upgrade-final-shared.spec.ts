import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { test, expect } from "@playwright/test";
test("shared breadcrumbs, sync recovery and achievement notices remain usable", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/final-shared.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/lib/offline-queue": path.resolve("tests/fixtures/ui-upgrade/final-shared-queue.ts"),
    },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://shared.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Shared fixture</title></head><body><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => { errors.push(error.message); console.log(error.stack); });
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("https://shared.fixture");
    await page.evaluate(() => sessionStorage.clear());
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.getByText("Saved actions could not be checked")).toBeVisible();
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(
      breadcrumb.getByRole("link", { name: "Course records", exact: true }),
    ).toHaveAttribute("href", "/courses/course-a/records");
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Record detail");
    for (const target of [
      page.getByRole("button", { name: "Check again" }),
      page.getByRole("button", { name: "Dismiss achievement notification" }),
      breadcrumb.getByRole("link", { name: "Course detail", exact: true }),
    ]) {
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Repeat notification" }).click();
    await expect(
      page.getByRole("button", { name: "Dismiss achievement notification" }),
    ).toHaveCount(1);
    await expect(page.getByText("A complete description", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Recover storage" }).click();
    await expect(page.getByText("Saved actions need attention")).toBeVisible();
    const retry = page.getByRole("button", { name: "Retry queued upload sync" });
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`shared-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Switch account" }).click();
    await expect(page.getByText("Saved actions need attention")).toHaveCount(0);
    await page.getByRole("button", { name: "Dismiss achievement notification" }).click();
    await expect(
      page.getByRole("button", { name: "Dismiss achievement notification" }),
    ).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
